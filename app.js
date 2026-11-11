const express = require('express');
const cors = require('cors');
const { initializeDB } = require('./database/database');
const moviesRouter = require('./routes/movies');

const app = express();

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Middleware to parse incoming JSON payloads
app.use(express.json());

// Mount the Movie Management router at /movies
app.use('/movies', moviesRouter);

// Root route - Project Information, Student Details & Available Endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    project: 'Movie Management REST API',
    course: 'Backend Development Fundamentals (BDF) - Lab 3',
    student: {
      name: 'M Dharmik Satya',
      registrationNumber: '252U1R5075',
      section: '106 AI/DE-1A',
      faculty: 'CH SIVA SAI TEJA'
    },
    status: 'Server and Database Active',
    supportedFeatures: [
      'Partial title search (search_q using SQL LIKE)',
      'Dynamic sorting (order_by allowlist: id, title, director, genre, release_year, rating, ticket_price)',
      'Sorting direction (order: ASC, DESC)',
      'Price filtering (min_price, max_price, and combined price range via SQL BETWEEN)',
      'Pagination (limit and offset defaults and boundary checks)',
      'Strict input validation for POST and PUT requests',
      'Standard HTTP status codes (200, 201, 400, 404, 500)',
      'Consistent JSON responses',
      'Parameterized SQL queries to strictly prevent SQL injection'
    ],
    endpoints: [
      {
        method: 'GET',
        endpoint: '/',
        description: 'Root endpoint providing project overview and API specification'
      },
      {
        method: 'GET',
        endpoint: '/movies',
        description: 'Retrieve all movies (supports search_q, order_by, order, limit, offset, min_price, max_price, genre, release_year)'
      },
      {
        method: 'GET',
        endpoint: '/movies/:movieId',
        description: 'Retrieve a specific movie by its ID'
      },
      {
        method: 'POST',
        endpoint: '/movies',
        description: 'Add a new movie (validates title, director, genre, release_year, rating, ticket_price)'
      },
      {
        method: 'PUT',
        endpoint: '/movies/:movieId',
        description: 'Update an existing movie by its ID'
      },
      {
        method: 'DELETE',
        endpoint: '/movies/:movieId',
        description: 'Delete a movie by its ID'
      }
    ]
  });
});

// 404 Catch-All handler for non-existent endpoints
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Global 500 error handler middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: err.message
  });
});

const PORT = process.env.PORT || 3000;

// Start server if executed directly
if (require.main === module) {
  (async () => {
    try {
      await initializeDB();
      app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}/`);
      });
    } catch (error) {
      console.error(`Failed to start server: ${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = app;
