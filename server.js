const express = require('express');
const cors = require('cors');
const path = require('path');
require('./config/db');

// const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');

// Create an Express application
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/api/v1/public', express.static(path.join(__dirname, 'public')))

// app.use('/api/v1/frontend', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', authRoutes);
const PORT = process.env.PORT || 8005;

console.log(
  "MongoDB URI configured:",
  Boolean(process.env.MONGODB_URL)
);

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT} and accessible on all interfaces`);
});