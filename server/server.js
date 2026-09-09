import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { startWorker } from './workers/verificationWorker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5555;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start the background worker for processing email jobs
  startWorker();
});
