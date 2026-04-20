# National Passport Issuance System (NPIS)

**Lebanese American University - ECE Department** **Course:** Software Engineering (COE461)

A digital passport issuance and renewal platform developed by third-year Computer Engineering students.

## Development Team
* Mahmoud Al Ashkar
* Safi Aridi
* Jad Mghames
* Yasser Zebian

## Project Overview
NPIS is a secure e-government platform designed to digitize the Lebanese passport workflow. It replaces traditional manual processing with a role-based, automated web platform to reduce physical congestion at government branches and provide a transparent digital experience.

The platform connects three primary actors:
1. **Citizens:** Apply for passports, upload documents, and track status.
2. **Mukhtars (Verification Authorities):** Review queues and apply Reliable Electronic Signatures.
3. **General Security Officers:** Perform final approvals and trigger printing/delivery pipelines.

## Tech Stack
* **Frontend:** React, Vite, TypeScript, Tailwind CSS v4
* **Backend:** Node.js, Express
* **Database:** PostgreSQL (Supabase Cloud)

## Local Development Setup

### 1. Database Configuration
1. Create a `.env` file in the `backend/` directory.
2. Add the database connection string: `DATABASE_URL=your_postgres_url_here`
3. *Never commit your `.env` file to Git.*

### 2. Running the Backend
```bash
cd backend
npm install
node server.js
