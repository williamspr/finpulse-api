# FinPulse API 💸

FinPulse is a modern, robust RESTful Financial Management API built with **Node.js**, **Express.js**, **TypeScript**, and **Prisma ORM**. It provides complete end-to-end solutions for multi-wallet tracking, transaction logging (income, expenses, and cross-currency transfers), budget threshold monitoring, and comprehensive financial summary reporting with PDF/CSV export capabilities.

---

## 🛠️ Tech Stack

* **Runtime & Framework:** Node.js, Express.js
* **Language:** TypeScript
* **Database & ORM:** PostgreSQL, Prisma ORM (v6)
* **Authentication:** JWT (Access Token) + HTTP-Only Cookie (Refresh Token)
* **Validation:** Zod
* **Testing:** Vitest, Supertest
* **API Documentation:** OpenAPI 3.0.3 (Swagger UI / Redoc)

---

## ✨ Features

* **🔐 Auth & User Management:** User registration, secure login with JWT, HTTP-only cookie-based refresh token rotation, logout, and user profile retrieving (`/auth/me`).
* **💼 Wallet Management:** Multi-account / multi-wallet support with multi-currency balance tracking.
* **🏷️ Category Management:** Customizable categories categorized by transaction type (`INCOME`, `EXPENSE`, `TRANSFER`).
* **💸 Transaction Operations:** 
  * Real-time balance calculations for `INCOME` and `EXPENSE`.
  * Support for cross-currency `TRANSFER` with exchange rate conversion.
  * Automatic wallet balance reversion upon updating or deleting transactions with negative balance guardrails.
* **🎯 Budget Tracking:** Set monthly expense limits per category and monitor real-time spending progress against defined limits.
* **📊 Reports & Analytics:** Financial summary report generation (`totalIncome`, `totalExpense`, `netCashFlow`) and direct document exporting in **PDF** and **CSV** formats.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your local machine:
* **Node.js** (v18 or higher)
* **npm** or **pnpm**
* **PostgreSQL**

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/williamspr/finpulse-api.git
   cd finpulse-api
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Copy the example environment file and configure your variables:
   ```bash
   cp .env.example .env
   ```
   Open .env and fill in your database connection string and JWT secrets:
   ```
   PORT=5000
   NODE_ENV="development"
  
   DATABASE_URL="postgresql://user:password@localhost:5432/finpulse_db?schema=public"
  
   JWT_ACCESS_SECRET="your_jwt_access_secret_key"
   JWT_ACCESS_EXPIRES_IN="15m"
   JWT_REFRESH_SECRET="your_jwt_refresh_secret_key"
   JWT_REFRESH_EXPIRES_IN="7d"
   ```

4. **Database Setup & Migrations:**
   Run Prisma migrations to set up your database schema:
   ```bash
   npx prisma migrate dev
   ```

5. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The API server will run at `http://localhost:5000`

### 🧪 Running Tests
FinPulse utilizes Vitest for unit and integration testing.
```bash
# Run all unit and integration tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run test coverage report
npm run test:coverage
```

### 📖 API Documentation & Manual Testing

* **OpenAPI Spec:** The full API specification is located in `openapi.yaml`.
* **Swagger UI Integration:** You can view the visual documentation locally by integrating `swagger-ui-express` or importing `openapi.yaml` into [Swagger Editor](https://editor.swagger.io/).
* **Manual Testing:** A pre-configured `manual-test.http` file is included in the root directory for quick API testing using the **REST Client** extension in VS Code.

### 📁 Project Structure
```plaintext
.
├── prisma/               # Database schema and migration files
├── src/                  # Source code (Controllers, Services, Routes, Middlewares)
├── test/                 # Vitest test suites (Integration & Unit tests)
├── .env.example          # Environment variables template
├── manual-test.http      # HTTP requests for REST Client extension
├── openapi.yaml          # OpenAPI 3.0.3 API specification
├── tsconfig.json         # TypeScript configuration
└── vitest.config.ts      # Vitest configuration
```

### 📄 License

This project is open-source and available under the [MIT License](LICENSE).
