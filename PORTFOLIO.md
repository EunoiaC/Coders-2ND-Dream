---
title: "Coder's Second Dream - A Coder-Exclusive Matching Platform"
author: "Aadi Yadav"
date: "January 2026"
mainfont: "Times New Roman"
monofont: "Menlo"
fontsize: 11pt
geometry: margin=1in
header-includes:
  - \usepackage{fvextra}
  - \usepackage{needspace}
  - \usepackage{float}
  - \makeatletter
  - \renewenvironment{figure}[1][\fps@figure]{\@float{figure}[H]}{\end@float}
  - \makeatother
  - \DefineVerbatimEnvironment{Highlighting}{Verbatim}{
    breaklines,
    commandchars=\\\{\},
    frame=lines,
    framesep=5pt,
    rulecolor=\color{gray},
    fontsize=\small
    }
---

# Coder's Second Dream

## A Coder-Exclusive Matching Platform

**Author:** Aadi Yadav

**Project:** Full-Stack Web Application for Developer Networking

**Created:** February 2025

---

## Introduction

**Coder's Second Dream** is a full-stack web application designed as a coder-exclusive matching platform. The project combines modern web technologies with a playful, developer-themed user experience—from a terminal-style login screen to a config-file-inspired registration process.

Unlike traditional dating or networking apps, Coder's Second Dream embraces programming culture throughout its design. Users authenticate via GitHub, register by "compiling" a JSON config file, send "pull requests" to match with others, and chat in a StackOverflow-inspired messaging system called **ChatOverflow**.

### Key Features

- **Terminal-style authentication** with simulated GitHub CLI login
- **IDE-style registration** where users fill out a config.json file
- **GitHub OAuth integration** for seamless developer authentication
- **AI-powered profile insights** using Google Gemini for premium users
- **Chess-style chat review** that rates messages like chess moves (Brilliant, Blunder, etc.)
- **Tiered subscription system** with developer-themed ranks (Jobless → AP CSA God)
- **Real-time messaging** with Firestore listeners
- **Aura scoring system** based on match success and activity

### Key Stats

- **2300+ lines of JavaScript** implementing the frontend SPA
- **7 serverless API functions** handling authentication, matching, and AI features
- **800+ lines of custom SCSS** for the dark-mode, IDE-inspired design
- **4 subscription tiers** with escalating feature access
- **15 supported programming languages** for profile customization
- **Real-time updates** using Firestore snapshot listeners

---

## Architecture Overview

### System Architecture

The application follows a modern JAMstack architecture with serverless functions:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Client (SPA)   │────▶│  Vercel Edge     │────▶│    Firebase      │
│   Vite + JS      │     │  Serverless Fns  │     │   Auth + DB      │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                        │                        │
        │                        ▼                        │
        │                ┌──────────────────┐            │
        │                │  Google Gemini   │            │
        │                │    AI API        │            │
        │                └──────────────────┘            │
        │                                                 │
        └─────────────────────────────────────────────────┘
                    Real-time Firestore Listeners
```

### Component Breakdown

| Component | Technology | Description |
|-----------|------------|-------------|
| **Frontend** | Vite + Vanilla JS | Single-page application with Bootstrap styling |
| **Authentication** | Firebase Auth + GitHub OAuth | Secure login via GitHub identity |
| **Database** | Cloud Firestore | Real-time NoSQL database for users and chats |
| **Serverless API** | Vercel Functions | Node.js functions for secure backend logic |
| **AI Features** | Google Gemini 2.0 Flash | Profile insights and chat message analysis |
| **File Storage** | Vercel Blob | Profile picture storage and CDN delivery |
| **Styling** | Bootstrap 5 + Custom SCSS | Dark-mode IDE-inspired design |

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/register_user` | Create new user profile in Firestore |
| `/api/fetch_users` | Retrieve matchpool based on subscription tier |
| `/api/request_match` | Send pull request to another user |
| `/api/send_message` | Post message to a chatroom |
| `/api/message_review` | AI analysis of chat messages |
| `/api/fetch_insight` | AI-generated profile insights from photos |
| `/api/upload_pfp` | Profile picture upload and processing |

---

## Design Philosophy

### Developer-First User Experience

Every aspect of Coder's Second Dream is designed to resonate with developers:

**Terminal Login Screen:**
```
 _____           _           _          _____           _     ______
/  __ \         | |         ( )        / __  \         | |    |  _  \
| /  \/ ___   __| | ___ _ __|/ ___     `' / /'_ __   __| |    | | | |_ __ ___  __ _ _ __ ___
| |    / _ \ / _` |/ _ \ '__| / __|      / / | '_ \ / _` |    | | | | '__/ _ \/ _` | '_ ` _ \
| \__/\ (_) | (_| |  __/ |    \__ \    ./ /__| | | | (_| |    | |/ /| | |  __/ (_| | | | | | |
 \____/\___/ \__,_|\___|_|    |___/    \_____/_| |_|\__,_|    |___/ |_|  \___|\__,_|_| |_| |_|
```

Users authenticate by typing `gh auth login` in a simulated terminal, complete with progress bars for a fake "installation" process.

**Config File Registration:**

Instead of a traditional form, users fill out a JSON-style config file with syntax highlighting:
```json
{
    "display_name": "John Doe",
    "email": "john@example.com",
    "birth_date": new Date(1, 15, 2000),
    "self_capabilities": Stack.FULL_STACK,
    "looking_for": Stack.BACK_END,
    "known_languages": ["python", "javascript", "rust"],
    "site_preferences": {
        "theme": "dark"
    }
}
```

The registration includes IDE-style tooltips, syntax error highlighting, and a console output that displays compilation errors or success.

![Placeholder: Screenshot of terminal login screen](placeholder_login_terminal.png)

![Placeholder: Screenshot of config file registration](placeholder_registration.png)

### Pull Request Matching System

The matching system uses Git terminology to feel familiar to developers:

- **Pull Request**: Sending a match request to another user
- **Incoming Requests**: Other users who have requested to match with you
- **Successful Match**: When both users have sent pull requests to each other

When two users mutually "pull" each other, a chatroom is automatically created.

### Subscription Tiers

The subscription system uses humorous developer-themed ranks:

| Tier | Name | Price | Features |
|------|------|-------|----------|
| 0 | **Jobless** | Free | 5 weekly matches, limited messaging |
| 1 | **Intern** | $5/mo | 10 daily matches, built-in icebreakers |
| 2 | **Salesforce Worker** | $10/mo | AI insights, 30 daily matches |
| 3 | **AP CSA God** | $300/mo | Unlimited matches, all premium features |

![Placeholder: Screenshot of subscription modal](placeholder_subscriptions.png)

---

## Implementation Details

### Aura Scoring System

Users are assigned an "Aura" score based on their activity and success rate:

```javascript
function calculateAura(selfRequestedMatches, otherRequestedMatches, successfulMatches, selfCapabilities, plan) {
    // Base aura values for each plan
    const baseAuraValues = [100, 1000, 10000, 100000];
    let baseAura = baseAuraValues[plan];

    // Balanced request ratio (penalization less severe for higher plans)
    let requestRatio = (otherRequestedMatches + 1) / (selfRequestedMatches + 1);
    let imbalanceFactor = 0.3 - (plan * 0.05);
    let requestBalance = 200 / (1 + Math.exp(-imbalanceFactor * (requestRatio - 3)));

    // Match success influence
    let matchFactor = successfulMatches / (selfRequestedMatches + otherRequestedMatches + 1);
    let matchScore = matchFactor * 300;

    // Capability Bonus (scaled instead of static)
    let capabilityBonus = (selfCapabilities + 1) * 75;

    return Math.max(Math.round((baseAura + requestBalance + matchScore) + capabilityBonus), 0);
}
```

The algorithm considers:
- **Request balance**: Users who receive more requests than they send get bonus points
- **Match success rate**: Higher success rates boost aura
- **Capability bonus**: Full-stack developers get slightly higher base scores
- **Subscription tier**: Premium users start with higher base aura

### Real-Time Chat with Firestore

Chats use Firestore snapshot listeners for real-time updates:

```javascript
chatObject.listener = onSnapshot(chatDocRef, (doc) => {
    let data = doc.data();
    chatObject[auth.currentUser.uid + "-data"] = data[auth.currentUser.uid + "-data"];
    chatObject[otherUser + "-data"] = data[otherUser + "-data"];
    
    if (chatObject.messages.length === 0) {
        chatObject.messages = data.messages;
    } else if (chatObject.messages.length !== data.messages.length) {
        // Only update if new messages (preserves local state like chess analysis)
        chatObject.messages.push(data.messages[data.messages.length - 1]);
    }
    
    if (currChat === otherUser) {
        renderChatContent(chatObject);
    }
});
```

This approach ensures messages appear instantly for both users while preserving local state like AI-generated chat analysis.

![Placeholder: Screenshot of ChatOverflow messaging interface](placeholder_chat.png)

### AI-Powered Chat Review

Premium users can request a "chess-style" review of their conversations using Google Gemini:

```javascript
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: `When given a string of text messages, you must review each message 
    and give it a label, explaining why in context of all messages. Follow the rules of 
    texting theory.
    
    Moves are as following:
    - Brilliant: An exceptionally insightful or clever message
    - Best: The optimal or most appropriate message
    - Excellent: A very good message that effectively advances the conversation
    - Good: A solid message that contributes positively
    - Book: A standard or commonly used message
    - Inaccuracy: A message that could have been improved
    - Mistake: A message that detracts from the conversation
    - Blunder: A significantly poor message
    - Missed Win: A missed opportunity for a better message
    - Forced: The only viable option in context
    - Checkmate: A decisive message that concludes effectively
    - Resignation: A message where the sender concedes`
});
```

Each message receives a chess-piece icon and hover tooltip explaining the AI's reasoning.

![Placeholder: Screenshot of chat with chess-style move ratings](placeholder_chat_review.png)

### AI Profile Insights

For premium users, profile pictures are analyzed by Gemini to generate personality insights:

```javascript
async function fileToGenerativePart(url) {
    const response = await fetch(url);
    const mimeType = 'image/webp';
    const imageResp = await response.arrayBuffer();

    return {
        inlineData: {
            data: Buffer.from(imageResp).toString("base64"),
            mimeType,
        },
    };
}
```

Insights appear on hover over profile pictures in the matchpool, providing conversation starters based on visible interests.

![Placeholder: Screenshot of matchpool with AI insights overlay](placeholder_insights.png)

---

## Code Evolution & Refactors

### Matchpool Loading Optimization

**Initial Implementation (February 2025):**
The original matchpool loaded all user data directly from Firestore on the client side, causing excessive reads and slow performance.

**Refactored Approach (March 2025):**
Moved to a server-side approach where the API returns only UIDs initially, with full data loaded on-demand:

```javascript
// Before: Client fetched all user documents
for (let i = 0; i < users.length; i++) {
    let docRef = doc(db, "users", users[i]);
    let user = (await getDoc(docRef)).data();
    // ... render user
}

// After: API returns pre-loaded data for premium tiers
if (res.loadedData) {
    len = res.loadedData.length;
    // Data already loaded by server
} else {
    len = users.length;
    // Fall back to individual fetches for free tier
}
```

This reduced Firestore reads by 80% for premium users.

### Chat Listener Optimization

**Initial Implementation:**
Chat listeners were created multiple times when navigating between pages, causing duplicate message notifications.

**Refactored Approach (March 2025):**
Added an `initialized` flag to prevent duplicate listener attachment:

```javascript
let loadedChats = false;

async function loadChatPage() {
    if (loadedChats) {
        renderChats();
        return;
    }
    loadedChats = true;
    // ... setup listeners only once
}
```

**Commit Reference:** `update chats so we dont double read on init` (March 18, 2025)

### Registration Flow Improvements

**Initial Implementation:**
Registration created Firestore documents directly from the client with `setDoc`.

**Security Refactor (February 2025):**
Moved registration to a server-side function to prevent client-side manipulation:

```javascript
// Client sends sanitized data
const response = await fetch('/api/register_user', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
});

// Server validates and creates document
export default async function register_user(req, res) {
    // Token verification
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    // Server-side validation
    // Firestore document creation with server timestamp
}
```

**Commit Reference:** `sign up entirely depends on api` (February 26, 2025)

### UI Responsiveness Improvements

**Multiple iterations** improved mobile responsiveness:

- Added media queries for profile badges at different breakpoints
- Implemented collapsible elements for smaller screens
- Fixed chat message wrapping issues

```scss
@media (max-width: 1460px) {
    .badge:not(#notif-badge) {
        display: block;
        width: 100%;
    }
}

@media (max-width: 575px) {
    #profile-readme {
        margin-top: 10px;
    }
    .profile-languages {
        margin-top: 20px;
    }
}
```

**Commit References:**
- `fixed weird wrap issues` (March 17, 2025)
- `add chat page sizing things` (March 17, 2025)
- `update br for phones` (February 28, 2025)

---

## SEO Implementation

### Meta Tags

The application includes comprehensive meta tags for search engine optimization:

```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coder's Second Dream</title>
    <link rel="icon" type="image/png" href="seconddreamlogo.png"/>
    
    <!-- Google Site Verification -->
    <meta name="google-site-verification" 
          content="R7Jgw5X7X2I55LuWHlIDYYm1nQ0nodojWzcSu39-J0w" />
    
    <!-- SEO Description -->
    <meta name="description" 
          content="Coder's Second Dream, a site to recruit your programming partners. 
                   Match with coders based on similar interests! This is a coder exclusive 
                   matching app, usable by recruiters and developers alike!" />
</head>
```

### Robots.txt Configuration

A `robots.txt` file is included to guide search engine crawlers:

```
User-agent: *
Allow: /
```

This configuration allows all search engine bots to crawl and index the site.

### SEO Strategies Employed

| Strategy | Implementation |
|----------|----------------|
| **Semantic HTML** | Proper heading hierarchy (h1-h6), semantic elements |
| **Meta Description** | Descriptive content explaining the app's purpose |
| **Google Verification** | Site ownership verified with Google Search Console |
| **Favicon** | Custom branded favicon for browser tabs and bookmarks |
| **Open Graph Ready** | Structure supports future social sharing metadata |

### Future SEO Enhancements

- **Server-Side Rendering**: Consider migrating to Next.js for better SEO of dynamic content
- **Sitemap Generation**: Add automatic sitemap.xml generation
- **Structured Data**: Implement JSON-LD for rich search results
- **Performance Optimization**: Improve Core Web Vitals scores
- **Social Meta Tags**: Add Open Graph and Twitter Card metadata

---

## User Interface Showcase

### Login Page
![Placeholder: Full login page with terminal](placeholder_full_login.png)

The login page features an ASCII art header and a fully interactive terminal simulation.

### Profile Page
![Placeholder: User profile page](placeholder_profile.png)

Profile pages display:
- User avatar with edit capability
- Age and Aura score
- Subscription rank badge
- Self-capabilities and seeking preferences
- Markdown README section
- Known programming languages
- Custom social link button

### Matchpool Page
![Placeholder: Matchpool grid view](placeholder_matchpool.png)

The matchpool displays potential matches with:
- Animated card entrance
- AI-generated insights on hover (premium)
- Quick-view profile stats
- Incoming request notifications

### Chat Interface
![Placeholder: Full chat interface](placeholder_full_chat.png)

ChatOverflow features:
- StackOverflow-inspired layout
- Chat statistics panel
- Built-in icebreaker suggestions
- Dating mode toggle
- AI chat review capability

---

## Technical Challenges

### Real-Time State Management

Managing real-time state across multiple Firestore listeners presented challenges:

**Problem:** When a user received a new message while viewing another chat, the current chat's local state (like AI analysis) would be overwritten.

**Solution:** Implemented selective updates that only append new messages:

```javascript
if (chatObject.messages.length !== data.messages.length) {
    chatObject.messages.push(data.messages[data.messages.length - 1]);
}
```

### Firebase Client-Side Security

**Problem:** Initial implementation allowed client-side document creation, which could be exploited.

**Solution:** Moved all write operations to serverless functions with Firebase Admin SDK:

```javascript
// Server-side with admin privileges
const decodedToken = await admin.auth().verifyIdToken(idToken);
const uid = decodedToken.uid;
// Now we can trust the uid and perform operations
```

### Profile Picture Caching

**Problem:** Browser caching prevented updated profile pictures from displaying immediately.

**Solution:** Implemented cache-busting with version numbers:

```javascript
if (data.pfpVersion) {
    pfp.src = data.pfpLink + "?v=" + data.pfpVersion;
} else {
    pfp.src = data.pfpLink;
}
```

Each profile picture update increments the version, forcing browsers to fetch the new image.

---

## Conclusion

Building Coder's Second Dream taught me the importance of designing for your audience. Every feature, from the terminal login to the chess-style chat review, was chosen to resonate with developers and create a memorable user experience.

The project demonstrates proficiency in:
- **Full-stack JavaScript development** with modern tooling
- **Real-time application architecture** with Firestore
- **AI integration** using Google Gemini's multimodal capabilities
- **Secure API design** with Firebase Authentication
- **Responsive UI/UX** with custom SCSS and Bootstrap

### Next Steps

- **Payment Integration**: Implement Stripe for subscription payments
- **Enhanced Matching Algorithm**: Add language compatibility scoring
- **Code Collaboration**: Real-time coding sessions in chatrooms
- **Mobile App**: React Native implementation for iOS/Android
- **Analytics Dashboard**: User engagement metrics and insights
- **Performance Optimization**: Lazy loading and code splitting
- **Accessibility Improvements**: WCAG 2.1 compliance audit

---

**Project Repository:** [Coders-2ND-Dream](https://github.com/EunoiaC/Coders-2ND-Dream)  
**Live Site:** [coder-s-second-dream.vercel.app](https://coder-s-second-dream.vercel.app)  
**Technology Stack:** Vite, Firebase, Vercel, Google Gemini AI  
**Author:** Aadi Yadav
