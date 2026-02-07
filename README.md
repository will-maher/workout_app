# Workout App

A comprehensive workout tracking application built with React frontend and Node.js backend, featuring performance analytics, workout planning, and exercise library management.

## Features

- **Workout Tracking**: Log sets, reps, and weights for exercises
- **Performance Analytics**: Track 1RM progress with LOESS smoothing
- **Workout Planning**: Create and manage workout programs
- **Exercise Library**: Browse and manage exercises by muscle group
- **User Authentication**: Secure JWT-based authentication
- **Responsive Design**: Mobile-friendly interface
- **Data Visualization**: Interactive charts using Highcharts

## Tech Stack

### Frontend
- React 18
- Material-UI (MUI)
- React Router
- Axios
- Highcharts
- Date-fns

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT Authentication
- bcryptjs

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd workout_app
```

### 2. Backend Setup
```bash
cd backend
npm install
```

### 3. Environment Configuration
Create a `.env` file in the backend directory:
```bash
cp env.example .env
```

Update the `.env` file with your configuration:
```env
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your_jwt_secret_key_here
PORT=5001
NODE_ENV=development
```

### 4. Database Setup
```bash
# Initialize the database schema
npm run init-db
```

### 5. Frontend Setup
```bash
cd ../frontend
npm install
```

### 6. Start the Application

#### Development Mode
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

#### Production Mode
```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm run build
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Exercises
- `GET /api/exercises` - Get all exercises
- `POST /api/exercises` - Create new exercise

### Workouts
- `GET /api/workouts` - Get user workouts
- `POST /api/workouts` - Create new workout
- `GET /api/workouts/:id` - Get specific workout
- `PUT /api/workouts/:id` - Update workout
- `DELETE /api/workouts/:id` - Delete workout

### Statistics
- `GET /api/stats/performance/sets` - Get performance data
- `GET /api/stats/weekly-sets-by-muscle-group` - Get weekly volume
- `GET /api/stats/one-rep-max` - Get 1RM statistics

### Plans
- `GET /api/plan` - Get user's workout plan
- `POST /api/plan` - Save workout plan

## Deployment

### Railway Deployment
This app is configured for Railway deployment. The following environment variables are automatically set by Railway:
- `DATABASE_URL`
- `PORT`
- `NODE_ENV`

You only need to set:
- `JWT_SECRET`

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token signing
- `PORT`: Server port (default: 5001)
- `NODE_ENV`: Environment (development/production)

## Project Structure

```
workout_app/
├── backend/
│   ├── routes/           # API route handlers
│   ├── scripts/          # Database scripts
│   ├── server.js         # Express server
│   ├── database.pg.js    # PostgreSQL connection
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── App.js        # Main app component
│   │   └── index.js      # App entry point
│   └── package.json
├── schema.sql            # Database schema
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue in the GitHub repository.