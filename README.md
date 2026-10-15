# SwarnaLoan: Gold Loan Portal with an AI Agent


A production-minded, full-stack gold loan intake web portal built for **T Global's Full Stack Developer Intern Technical Assignment**.

The system enables borrowers and field agents to get instant, regulation-compliant gold loan quotes, apply via a **3-step guided intake form** or a conversational **AI Loan Assistant**, and manage applications through an **Admin Field Agent Dashboard**.

---

##  System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               React + Vite + Tailwind Client           │
                    │   (Guided Form  ·  AI Chat Agent  ·  Admin Dashboard)  │
                    └───────────────────────────┬────────────────────────────┘
                                                │ REST API (JSON)
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Express.js Backend Server                                   │
│                                                                                             │
│  ┌───────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────┐  │
│  │    Validation (Zod)   │   │   Financial Math Engine   │   │   AI Agent Engine (Gemini │  │
│  │ • 0 < net <= gross    │   │ • Pure Gold = net*(k/24)  │   │   + 3 Typed Backend Tools │  │
│  │ • Indian 10-digit mob │   │ • Market Value @ ₹7,000/g │   │ • get_loan_schemes()      │  │
│  │ • 18 / 22 / 24 Karat  │   │ • Max LTV <= 75%          │   │ • calculate_quote()       │  │
│  │ • Name 2-60 chars     │   │ • Whole Rupee Floor       │   │ • submit_application()    │  │
│  └───────────────────────┘   └───────────────────────────┘   └───────────────────────────┘  │
│                                           │                                                 │
│                     ┌─────────────────────┴─────────────────────┐                           │
│                     │       Lead Service & Concurrency Lock     │                           │
│                     │ • 7-day de-duplication (409 Conflict)     │                           │
│                     │ • Idempotency-Key header support          │                           │
│                     │ • Masked mobile numbers (9876XXXX10)      │                           │
│                     └─────────────────────┬─────────────────────┘                           │
└───────────────────────────────────────────┼─────────────────────────────────────────────────┘
                                            ▼
                                  MongoDB (Mongoose)
                             • loan_schemes (Seeded plans)
                             • leads (Applications & Audit Log)
```

---

##  Quick Start & Installation

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v22.14.0)
- **MongoDB**: Local MongoDB server or MongoDB Atlas (tested on MongoDB v8.0.4)

### 2. Install Dependencies
Run `npm install` at the project root to install dependencies for both `server` and `client`:
```bash
npm install
```

### 3. Environment Setup
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Default configuration:
```ini
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/gold_loan_portal
GOLD_RATE_24K_PER_GRAM=7000
MAX_ALLOWED_LTV=0.75
# Optional: Add GEMINI_API_KEY for cloud LLM; if empty, built-in deterministic agent executes out-of-the-box!
GEMINI_API_KEY=
```

### 4. Seed the Database
Seed the two required loan schemes (`PLAN_EMI_01` and `PLAN_BULLET_01`):
```bash
npm run seed
```

### 5. Run Development Servers
Start both the backend server and Vite frontend concurrently:
```bash
npm run dev
```
- **Web Portal**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)

---
## Gold Loan Portal
<img width="1917" height="1020" alt="image" src="https://github.com/user-attachments/assets/fd67efd4-b6a3-48bd-94f9-e48e89771692" />

<img width="1917" height="952" alt="image" src="https://github.com/user-attachments/assets/5e497055-7c74-4fb1-8546-b44bdab2de90" />

<img width="1897" height="931" alt="image" src="https://github.com/user-attachments/assets/8859172b-a5dc-4717-a961-afa333e210c8" />

<img width="1902" height="963" alt="image" src="https://github.com/user-attachments/assets/e2b31b0a-d181-4520-8024-88107d90ac8f" />

<img width="1390" height="888" alt="image" src="https://github.com/user-attachments/assets/00f6f28d-6070-4041-aa4b-951450e30925" />


##  Testing & Automated Evaluation

The test suite thoroughly covers all requirements, financial edge cases, and conversational evals.

### Run All Unit & Integration Tests (18 Tests)
```bash
npm test
```
**Test Coverage Includes:**
- **Financial Math**:
  - Test 1: $45\text{g net} \cdot 22\text{K} \cdot \text{EMI} \rightarrow \text{pure } 41.25\text{g}, \text{value } ₹2,88,750, \text{loan } ₹2,16,562$ (201 Created).
  - Test 2: $45\text{g net} \cdot 22\text{K} \cdot \text{Bullet} \rightarrow \text{value } ₹2,88,750, \text{loan } ₹2,02,125$ (70% LTV).
  - Test 3: $10\text{g net} \cdot 18\text{K} \cdot \text{EMI} \rightarrow \text{pure } 7.5\text{g}, \text{value } ₹52,500, \text{loan } ₹39,375$.
  - Regulatory Cap: Capped at 75% LTV even if plan specifies higher.
- **Validation**:
  - Test 4: Net weight ($52\text{g}$) $>$ gross weight ($50\text{g}$) $\rightarrow$ 400 Bad Request with field error on `netWeightGrams`.
  - Test 5: Invalid mobile (`5876543210` or `98765`) $\rightarrow$ 400 Bad Request with field error on `mobileNumber`.
- **Duplicates & Hardening**:
  - Test 6: Same mobile within 7 days $\rightarrow$ 409 Conflict with existing `applicationId`.
  - Test 7 (Bonus): Same request with same `Idempotency-Key` $\rightarrow$ original 201 response replayed.
  - Test 8 (Bonus): 2 concurrent requests with same mobile $\rightarrow$ exactly one 201 and one 409.
  - Privacy: Mobile numbers masked in all API responses (`9876XXXX10`).

### Run AI Agent Conversational Evaluation Runner (`npm run eval`)
```bash
npm run eval
```
Evaluates all **5 core conversations** specified in the brief:
1. **Happy path**: Conversational quote through to confirmed submission.
2. **Missing field**: Agent identifies missing purity/weights and prompts conversationally.
3. **Validation error**: Rejects net weight ($52\text{g}$) $>$ gross ($50\text{g}$) and asks for correction.
4. **Duplicate rejection**: Explains existing application `GL-XXXX` within 7 days.
5. **Off-topic guardrail**: Politely declines investment/crypto advice.

---

##  Business Rules & Financial Math

| Parameter | Formula / Rule | Example ($45\text{g}, 22\text{K}$) |
| :--- | :--- | :--- |
| **Pure Gold** | $\text{netWeightGrams} \times \left(\frac{\text{karat}}{24}\right)$ | $45 \times \frac{22}{24} = 41.25\text{ grams}$ |
| **Market Gold Value** | $\text{pureGoldGrams} \times ₹7,000$ | $41.25 \times 7000 = ₹2,88,750$ |
| **Eligible Loan (EMI)** | $\lfloor \text{goldValue} \times \min(\text{maxLtv}, 0.75) \rfloor$ | $\lfloor 288750 \times 0.75 \rfloor = ₹2,16,562$ |
| **Eligible Loan (Bullet)** | $\lfloor \text{goldValue} \times \min(0.70, 0.75) \rfloor$ | $\lfloor 288750 \times 0.70 \rfloor = ₹2,02,125$ |
| **Storage Standard** | Whole rupees & integer paise | Stored as integer paise (`eligibleLoanPaise`) |

### Active Seeded Plans
1. **`PLAN_EMI_01` (Monthly EMI)**:
   - Interest: 10.5% p.a.
   - Max LTV: 75%
   - Tenure: 12 months, equal monthly instalments
2. **`PLAN_BULLET_01` (Bullet Repayment)**:
   - Interest: 12.0% p.a.
   - Max LTV: 70%
   - Tenure: 12 months, interest + principal at maturity

---

## REST API Specification

### 1. `GET /api/v1/loan-schemes`
Returns active gold loan schemes seeded from database. Max LTV is strictly capped at 75%.

### 2. `POST /api/v1/quotes`
Pure calculation endpoint with **zero database writes**. Used identically by the frontend calculator and AI agent.
- **Request Body:**
  ```json
  {
    "grossWeightGrams": 50,
    "netWeightGrams": 45,
    "karat": 22
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "pureGoldGrams": 41.25,
      "goldValue": 288750,
      "plans": [
        { "planId": "PLAN_EMI_01", "name": "Monthly EMI", "eligibleLoan": 216562 },
        { "planId": "PLAN_BULLET_01", "name": "Bullet Repayment", "eligibleLoan": 202125 }
      ]
    }
  }
  ```

### 3. `POST /api/v1/leads`
Validates input with Zod, recomputes quote server-side, checks 7-day duplication, stores lead with status `SUBMITTED`, and returns `201 Created`.
- **Headers:** Optional `Idempotency-Key: <unique-uuid>`
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "applicationId": "GL-1001",
    "status": "SUBMITTED",
    "lead": {
      "applicationId": "GL-1001",
      "fullName": "Rahul Sharma",
      "mobileNumber": "9876XXXX10",
      "eligibleLoan": 216562,
      "status": "SUBMITTED"
    }
  }
  ```
- **Error (409 Conflict):**
  ```json
  {
    "error": {
      "code": "DUPLICATE_APPLICATION",
      "message": "You already applied on 14 Oct, application GL-1001",
      "applicationId": "GL-1001"
    }
  }
  ```

### 4. `GET /api/v1/leads`
Returns leads newest first. Mobile numbers are **always masked** as `9876XXXX10`. Supports query filters: `?planId=PLAN_EMI_01&status=SUBMITTED`.

### 5. `PATCH /api/v1/leads/:id/status`
Advances status workflow (`SUBMITTED` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `APPROVED` / `REJECTED`) with an audit log trail.

### 6. `POST /api/v1/chat`
Conversational endpoint for the AI Loan Assistant with tool calling.

---

