# National Passport Issuance System (NPIS)

[cite_start]**Lebanese American University - ECE Department** **Course:** Software Engineering (COE461) [cite: 1]  

[cite_start]**Development Team:** * Mahmoud Al Ashkar 
* [cite_start]Safi Aridi 
* [cite_start]Jad Mghames 
* [cite_start]Yasser Zebian 

## Project Overview
[cite_start]The National Passport Issuance System (NPIS) is a secure e-government platform designed to digitize the Lebanese passport issuance and renewal workflow[cite: 5]. [cite_start]It replaces traditional manual processing with a role-based, automated web platform to reduce physical congestion at government branches and provide a transparent digital experience[cite: 6].

The platform connects three primary actors:
1. [cite_start]**Citizens:** Apply for passports, upload documents, and track status[cite: 30, 35].
2. [cite_start]**Mukhtars (Verification Authorities):** Review queues and apply Reliable Electronic Signatures[cite: 30, 155].
3. [cite_start]**General Security Officers:** Perform final approvals and trigger printing/delivery pipelines [cite: 30, 156-157].

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
