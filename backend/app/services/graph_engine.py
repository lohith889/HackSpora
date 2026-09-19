"""
Graph-Based Anomaly Engine — ENG-08

Uses NetworkX to build a heterogeneous graph from all historical
PM-KISAN applications and detect two classes of organised fraud:

  1. GRAPH_SYNDICATE_RESOURCE
     A Bank Account or Mobile Number node is shared by more than 3
     distinct farmers (degree > 3). This indicates a mule-account
     or SIM-swapping syndicate pooling shared resources.

  2. GRAPH_FRAUD_RING_CLUSTER
     The connected component that contains the current farmer has 5 or
     more distinct farmer nodes. This indicates an organised fraud ring
     submitting coordinated applications through shared infrastructure.

Graph schema
------------
  Nodes
    farmer_{aadhaar_ref}                  — type="farmer"
    bank_{bank_account_number}_{ifsc}     — type="bank"
    mobile_{mobile_number}                — type="mobile"
  Edges
    farmer  ─── bank     (resource_type="bank")
    farmer  ─── mobile   (resource_type="mobile")
"""

import logging
from typing import List

import networkx as nx
from sqlalchemy.orm import Session

from app.models import PMKisanApplicationDetails
from app.services.engine_types import AnomalyFlagResult

log = logging.getLogger(__name__)

# ── Tunable thresholds ─────────────────────────────────────────────────────
SHARED_RESOURCE_DEGREE_THRESHOLD = 3   # flag if degree EXCEEDS this value
FRAUD_RING_FARMER_THRESHOLD = 5        # flag if cluster has >= this many farmers
# ───────────────────────────────────────────────────────────────────────────


# ── Internal helpers ────────────────────────────────────────────────────────

def _farmer_node(record: PMKisanApplicationDetails) -> str:
    return f"farmer_{record.aadhaar_ref}"


def _bank_node(record: PMKisanApplicationDetails) -> str:
    return f"bank_{record.bank_account_number}_{record.ifsc_code}"


def _mobile_node(record: PMKisanApplicationDetails) -> str:
    return f"mobile_{record.mobile_number}"


def _build_graph(all_records: List[PMKisanApplicationDetails]) -> nx.Graph:
    """
    Construct the heterogeneous undirected graph from the full record set.
    Edge cases handled:
      - Empty record list → returns empty graph (no crash).
      - None/missing fields on a record → that record is skipped gracefully.
    """
    G = nx.Graph()

    for rec in all_records:
        try:
            # Guard against records with missing key fields
            if not all([rec.aadhaar_ref, rec.bank_account_number,
                        rec.ifsc_code, rec.mobile_number]):
                continue

            f_node = _farmer_node(rec)
            b_node = _bank_node(rec)
            m_node = _mobile_node(rec)

            G.add_node(f_node, type="farmer",
                       farmer_name=rec.farmer_name or "")
            G.add_node(b_node, type="bank",
                       resource=f"{rec.bank_account_number}/{rec.ifsc_code}")
            G.add_node(m_node, type="mobile",
                       resource=rec.mobile_number)

            G.add_edge(f_node, b_node, resource_type="bank")
            G.add_edge(f_node, m_node, resource_type="mobile")

        except Exception as exc:  # noqa: BLE001
            log.debug("graph_engine: skipped record id=%s — %s", rec.id, exc)

    return G


# ── Public entrypoint ───────────────────────────────────────────────────────

def run(
    details: PMKisanApplicationDetails,
    db: Session,
) -> List[AnomalyFlagResult]:
    """
    Graph-Based Anomaly Engine entry point.
    Fetches all applications, builds a graph, and runs two detection passes
    scoped only to the current applicant's neighbourhood/component.
    """
    flags: List[AnomalyFlagResult] = []

    # ── 1. Fetch historical + current applications ──────────────────────────
    try:
        all_records: List[PMKisanApplicationDetails] = (
            db.query(PMKisanApplicationDetails).all()
        )
    except Exception as exc:  # noqa: BLE001
        log.error("graph_engine: DB query failed — %s", exc)
        return flags  # fail open; do not block pipeline

    if not all_records:
        return flags

    # ── 2. Build graph ───────────────────────────────────────────────────────
    G = _build_graph(all_records)

    current_farmer_node = _farmer_node(details)

    # If the current applicant isn't in the graph (e.g. new, not yet
    # persisted), ensure they are represented so component logic works.
    if current_farmer_node not in G:
        b_node = _bank_node(details)
        m_node = _mobile_node(details)
        G.add_node(current_farmer_node, type="farmer",
                   farmer_name=details.farmer_name or "")
        if details.bank_account_number and details.ifsc_code:
            G.add_node(b_node, type="bank",
                       resource=f"{details.bank_account_number}/{details.ifsc_code}")
            G.add_edge(current_farmer_node, b_node, resource_type="bank")
        if details.mobile_number:
            G.add_node(m_node, type="mobile",
                       resource=details.mobile_number)
            G.add_edge(current_farmer_node, m_node, resource_type="mobile")

    # ── 3. Detection pass A — Shared Resource / Degree Centrality ──────────
    for neighbor in list(G.neighbors(current_farmer_node)):
        node_data = G.nodes[neighbor]
        node_type = node_data.get("type", "unknown")

        if node_type not in ("bank", "mobile"):
            continue

        degree = G.degree(neighbor)
        if degree > SHARED_RESOURCE_DEGREE_THRESHOLD:
            resource_label = node_data.get("resource", neighbor)
            flags.append(AnomalyFlagResult(
                anomaly_code="GRAPH_SYNDICATE_RESOURCE",
                severity="High",
                score=40,
                rationale=(
                    f"The {node_type} resource '{resource_label}' associated with this "
                    f"application is shared by {degree} distinct farmer(s) in the "
                    f"system — exceeding the syndicate threshold of "
                    f"{SHARED_RESOURCE_DEGREE_THRESHOLD}. This pattern is consistent "
                    f"with mule-account or SIM-swapping syndicate activity."
                ),
                evidence_json={
                    "node_type": node_type,
                    "resource": resource_label,
                    "shared_farmer_count": degree,
                    "threshold": SHARED_RESOURCE_DEGREE_THRESHOLD,
                },
            ))

    # ── 4. Detection pass B — Fraud Ring / Connected Component ──────────────
    try:
        component_nodes = nx.node_connected_component(G, current_farmer_node)
    except nx.NetworkXError as exc:
        log.debug("graph_engine: component lookup failed — %s", exc)
        component_nodes = set()

    farmer_nodes_in_component = [
        n for n in component_nodes
        if G.nodes[n].get("type") == "farmer"
    ]
    resource_nodes_in_component = [
        n for n in component_nodes
        if G.nodes[n].get("type") in ("bank", "mobile")
    ]

    farmer_count = len(farmer_nodes_in_component)

    if farmer_count >= FRAUD_RING_FARMER_THRESHOLD:
        connected_resources = [
            G.nodes[n].get("resource", n) for n in resource_nodes_in_component
        ]
        flags.append(AnomalyFlagResult(
            anomaly_code="GRAPH_FRAUD_RING_CLUSTER",
            severity="Critical",
            score=55,
            rationale=(
                f"This applicant belongs to a connected fraud cluster of {farmer_count} "
                f"distinct farmers sharing {len(resource_nodes_in_component)} common "
                f"resource(s) (bank accounts / mobile numbers). A cluster of this size "
                f"({farmer_count} ≥ threshold {FRAUD_RING_FARMER_THRESHOLD}) is a strong "
                f"indicator of an organised syndicate submitting coordinated fraudulent "
                f"PM-KISAN applications."
            ),
            evidence_json={
                "component_total_nodes": len(component_nodes),
                "farmer_count": farmer_count,
                "connected_resources": connected_resources,
                "ring_threshold": FRAUD_RING_FARMER_THRESHOLD,
            },
        ))

    return flags
