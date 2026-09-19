# Technology Stack — KisanGuard Portal

## Core Technologies

| Layer | Technology | Version / Spec | Rationale |
|---|---|---|---|
| **Backend Framework** | FastAPI | >=0.110.0 | High performance async REST API, automatic interactive Swagger UI, typed validation with Pydantic v2 |
| **Web Server** | Uvicorn (standard) | >=0.28.0 | ASGI web server for FastAPI |
| **Database** | SQLite + SQLAlchemy | SQLAlchemy >=2.0 | Lightweight, zero-config relational database for hackathon demo; relational schema with foreign keys and indexes |
| **Data Validation** | Pydantic | >=2.6.0 | Request/response schema definitions, field validation, type coercions |
| **Authentication** | python-jose & passlib[bcrypt] | bcrypt >=4.0, jose >=3.3.0 | Secure password hashing, JWT creation/decoding with expiry and role claims |
| **Data Science / ML** | thefuzz (fuzzy matching), scikit-learn, pandas, numpy | current | Robust fuzzy string matching for Hindi/English farmer name verification vs land & bank records; statistical aggregation |
| **Multipart & Uploads** | python-multipart | >=0.0.9 | Handling multipart/form-data for land document uploads |
| **Frontend Framework** | React 18 + Vite | Vite >=5.0, React >=18.2 | Fast HMR, minimal build overhead, robust component ecosystem |
| **Styling** | Tailwind CSS | >=3.4.0 | Clean, accessible, modern UI aligned with Indian government portal aesthetics (e.g. NIC/Digital India blue/saffron/green motifs) |
| **Icons & Visuals** | Lucide React | >=0.350.0 | High quality SVG icons for verification badges, status alerts, file uploads |
| **Charts** | Recharts | >=2.12.0 | Responsive charts for admin risk distribution, top anomalies, and geographic concentration |
| **HTTP Client** | Axios | >=1.6.0 | Clean interceptors for JWT injection and error handling |

## What NOT to Use and Why

- **MongoDB / NoSQL**: Relational joins between `applications`, `pm_kisan_details`, `land_records_master`, `bank_validation_master`, and `exclusion_master` are essential for fast cross-table fraud detection.
- **External Cloud Storage (S3/GCS)**: Local storage in `backend/uploads/` ensures 100% offline hackathon evaluation with zero external cloud dependencies.
- **Complex Microservices**: Monolithic FastAPI backend prevents network latency and deployment failure during demo evaluations.
