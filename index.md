I went through both documents:

* **SwiftyDrop Guard flow (product + system design)**
* **TEAM RESPONSIBILITIES (backend scope breakdown)**

Below is a **clean extraction of ALL backend responsibilities**, followed by a **Claude Code–ready backend execution specification (Markdown file)**.

---

# Backend Execution Spec — SwiftyDrop Guard

## Overview

SwiftyDrop Guard backend is responsible for:

* Data aggregation (airdrops, crypto, wallets)
* AI security intelligence engine
* Wallet safety analysis
* Telegram Mini App backend + bot logic
* Task tracking + gamification engine
* Notifications system
* User session + authentication
* Referral + retention systems

The backend is the **core intelligence + safety + data engine** of the entire product.

---

# 1. SYSTEM ARCHITECTURE

## Core Stack (recommended)

* Node.js (NestJS / Express)
* PostgreSQL (primary DB)
* Redis (caching + queues)
* Telegram Bot API
* Web3 providers (Alchemy / Moralis)
* External APIs (CoinGecko, GoPlus, etc.)

---

# 2. CORE BACKEND MODULES

---

# 2.1 Authentication & Telegram User System

## Responsibilities

### Features

* Telegram Mini App authentication
* User session creation
* User profile bootstrap on first login
* Referral tracking on signup

### Requirements

* Validate Telegram initData
* Create or fetch user
* Attach:

  * telegram_id
  * username
  * referral_code
  * wallet_address (optional)

### Database

```sql
users
- id
- telegram_id
- username
- referral_code
- referred_by
- xp
- streak
- level
- created_at
```

---

# 2.2 Airdrop Aggregation Engine

## Responsibilities

### Data Sources

* CoinGecko API
* CoinMarketCap API
* CryptoRank API
* Airdrops.io scraper fallback

### Features

* Fetch active airdrops
* Fetch upcoming campaigns
* Normalize token/project data
* Assign metadata:

  * reward estimate
  * category
  * deadlines
  * social links

### Backend Jobs

* Scheduled sync (cron every X hours)
* Deduplication engine
* Data normalization layer

### DB Schema

```sql
airdrops
- id
- name
- description
- reward_estimate
- deadline
- category
- trust_score
- difficulty
- social_links
- source
- created_at
```

---

# 2.3 AI Security Engine (CORE FEATURE)

## Responsibilities

This is the **main intelligence system**

### Inputs

* domain
* smart contract
* token info
* wallet behavior
* social links

### Analysis Modules

#### 1. Domain Analysis

* phishing detection patterns
* domain age check (if available)

#### 2. Smart Contract Scan

* GoPlus API
* Honeypot detection
* TokenSniffer signals

#### 3. Liquidity Analysis

* liquidity locked/unlocked
* volume anomalies

#### 4. Ownership Analysis

* ownership concentration
* renounced ownership check

#### 5. Social Authenticity

* fake engagement detection heuristics

---

## Output

```json
{
  "trust_score": 0-100,
  "risk_level": "low | medium | high",
  "scam_probability": 0-100,
  "warnings": [],
  "recommendation": "",
  "explanation": ""
}
```

---

## DB (optional caching)

```sql
security_reports
- id
- airdrop_id
- trust_score
- scam_probability
- risk_level
- explanation
- created_at
```

---

# 2.4 Wallet Safety Scanner

## Responsibilities

### Inputs

* wallet address

### APIs

* Etherscan API
* Moralis API
* Alchemy API
* Covalent API

---

### Analysis

#### 1. Transaction history

* suspicious patterns
* scam interactions

#### 2. Token approvals

* unlimited approvals detection

#### 3. Risk contracts

* interaction with flagged contracts

#### 4. Exposure analysis

* phishing association checks

---

## Output

```json
{
  "wallet_health_score": 0-100,
  "risk_indicators": [],
  "dangerous_approvals": [],
  "suspicious_contracts": [],
  "recommendations": []
}
```

---

# 2.5 Crypto Price & Token Data Service

## APIs

* CoinGecko
* Binance API

## Features

* token price
* market cap
* volume
* trending tokens

## Use Cases

* dashboard display
* airdrop context enrichment

---

# 2.6 Notification Engine (Telegram-first)

## Responsibilities

### Triggers

* new airdrop
* deadline alerts
* scam warnings
* wallet risks
* task updates

---

### Delivery Channels

* Telegram Bot API (primary)
* optional Firebase push

---

### System

* event-based queue
* cron scheduler
* user preference filters

---

### Example notifications

* “New verified airdrop available”
* “High-risk project detected”
* “Wallet exposed to risky contract”

---

# 2.7 Task Tracking System

## Responsibilities

* track user participation in airdrops
* manage checklist completion
* progress tracking
* deadline timers

---

## Default Task Template

```json
[
  "Follow Twitter",
  "Join Telegram",
  "Join Discord",
  "Connect Wallet",
  "Submit Wallet Address",
  "Share Referral Link"
]
```

---

## DB Schema

```sql
tasks
- id
- airdrop_id
- user_id
- status
- progress
- completed_at
```

---

# 2.8 Gamification Engine

## Responsibilities

* XP system
* streak tracking
* badges
* leaderboard
* levels

---

## Logic

### XP rules

* completing tasks → XP
* daily activity → streak boost
* referrals → bonus XP

---

## Badges

* Scam Hunter
* Verified Explorer
* Airdrop Master
* Daily Grinder
* Security Expert

---

## DB

```sql
user_stats
- user_id
- xp
- streak
- level
- badges[]
```

---

# 2.9 🔗 Wallet Connection Module

## APIs

* WalletConnect
* Web3Modal

## Responsibilities

* connect wallet session
* verify wallet ownership
* link wallet to user profile

---

# 2.10 Referral System

## Flow

* generate referral code per user
* track signup attribution
* reward system

---

## Rewards

* XP bonus
* referral points
* leaderboard boost
* streak boost

---

## DB

```sql
referrals
- id
- referrer_id
- referred_user_id
- reward_granted
```

---

# 2.11 Smart Alert System (Core Loop Engine)

## Responsibilities

Monitors:

* new airdrops
* expiring campaigns
* scam detection updates
* wallet risks
* trending tokens
* task deadlines

---

## Output Actions

* generate alert event
* push to Telegram
* update dashboard notifications

---

# 3. API ENDPOINT STRUCTURE

## REST or Modular API design

### Airdrops

* GET /airdrops
* GET /airdrops/:id

### Security

* POST /security/analyze-airdrop
* POST /security/analyze-wallet

### Wallet

* POST /wallet/connect
* GET /wallet/:address/analysis

### Tasks

* GET /tasks/:userId
* POST /tasks/update

### Gamification

* GET /user/stats
* POST /user/xp/update

### Notifications

* POST /notifications/send

### Auth

* POST /auth/telegram

---

# 4. BACKGROUND JOBS

* Airdrop sync job (cron)
* Scam re-evaluation job
* Notification scheduler
* Wallet risk re-check
* Leaderboard recalculation

---

# 5. EVENT SYSTEM (IMPORTANT)

Use event-driven architecture:

```ts
EVENTS:
- AIRDROP_CREATED
- AIRDROP_FLAGGED
- WALLET_RISK_DETECTED
- TASK_COMPLETED
- USER_SIGNUP
- REFERRAL_COMPLETED
```

---

# 6. CLAUDE CODE EXECUTION INSTRUCTIONS

## Build order:

### Phase 1

* Auth system (Telegram)
* DB schema
* User creation flow

### Phase 2

* Airdrop ingestion system
* API endpoints

### Phase 3

* AI Security Engine
* Wallet scanner

### Phase 4

* Task tracking system
* Gamification engine

### Phase 5

* Notification engine (Telegram bot)

### Phase 6

* Referral system + retention loop

---

# 7. CRITICAL PRODUCT RULES

* Security score must always be visible
* Every airdrop must have trust score
* Wallet scan must be async-safe
* Telegram is primary user channel
* System must degrade gracefully (fallback data required)

---

# 8. FINAL SYSTEM SUMMARY

Backend is composed of:

* Data ingestion layer (airdrops + crypto)
* AI risk intelligence engine
* Wallet safety analyzer
* User state engine (tasks, XP, streaks)
* Notification + retention system
* Telegram bot gateway

---

If you want, I can next:

convert this into a **real NestJS folder structure**
generate **Prisma schema + migrations**
or write a **Claude Code prompt that builds everything step-by-step automatically**
