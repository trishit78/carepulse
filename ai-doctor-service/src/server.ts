import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT ?? 4500;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'OK', service: 'ai-doctor-service' });
});

app.listen(PORT, () => {
  console.log(`AI Doctor Service running on port ${PORT}`);
});
