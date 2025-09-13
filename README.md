# Relatim - Real-time Chat Application

A modern real-time chat application with WebSocket support, built with React and Node.js.

## ✨ Features

- **Real-time messaging** with WebSocket support
- **User registration & authentication** via phone number
- **Contact management** - add friends by phone
- **Message history** stored in PostgreSQL
- **Responsive design** - works on desktop and mobile
- **WhatsApp-style UI** with proper message alignment

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Real-time**: WebSocket (ws library)
- **Styling**: CSS3 with flexbox

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Installation

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd relatim
   ```

2. **Install dependencies**:
   ```bash
   # Server
   cd server && npm install
   
   # Client  
   cd ../client && npm install
   ```

3. **Database setup**:
   - Create PostgreSQL database
   - Run the SQL schema from `db_update.sql` (if needed)
   - Set up `.env` file in server folder

4. **Start development servers**:
   ```bash
   # Terminal 1 - Server
   cd server && npm run dev
   
   # Terminal 2 - Client
   cd client && npm run dev
   ```

5. **Open browser**: http://localhost:5173

## 📱 How to Use

1. **Register/Login**: Enter your name and phone number
2. **Add Contacts**: Add friends by their phone numbers
3. **Start Chatting**: Select a contact and send messages
4. **Real-time**: Messages appear instantly across all tabs!

## 🏗️ Project Structure

```
relatim/
├── client/          # React frontend
│   ├── src/
│   │   ├── App.jsx  # Main chat component
│   │   ├── App.css  # Chat styling
│   │   └── main.jsx # Entry point
├── server/          # Node.js backend
│   ├── index.js     # Express + WebSocket server
│   └── package.json
└── README.md
```

## 🔧 API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/contacts` - Get user contacts
- `POST /api/contacts` - Add new contact
- `GET /api/conversations/:userId/messages` - Get messages
- `POST /api/conversations/:userId/messages` - Send message

## 📄 License

MIT