const http = require('http');
const app = require('./app');
const { initializeDB } = require('./database/database');

let server;
const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const status = response.status;
  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = await response.text();
  }
  return { status, data };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('--- Initializing DB & Server for Automated Verification ---');
  await initializeDB();

  server = app.listen(PORT, async () => {
    console.log(`Test server running on ${BASE_URL}\n`);

    try {
      console.log('=== TEST SUITE 1: ROOT & INFORMATIONAL ENDPOINT ===');
      {
        const res = await request('/');
        assert(res.status === 200, 'Root / returns 200 OK');
        assert(res.data.project === 'Movie Management REST API', 'Root returns project name');
        assert(res.data.student.registrationNumber === '252U1R5075', 'Root returns registration number 252U1R5075');
        assert(res.data.student.name === 'M Dharmik Satya', 'Root returns student name');
        assert(Array.isArray(res.data.endpoints), 'Root returns endpoints array');
      }

      console.log('\n=== TEST SUITE 2: POSITIVE CRUD & QUERY PARAMETERS (14 Scenarios) ===');
      // 1. GET all movies
      {
        const res = await request('/movies');
        assert(res.status === 200, '01. GET /movies returns 200 OK');
        assert(Array.isArray(res.data.data), '01. Data is an array');
        assert(res.data.data.length >= 15, `01. Retrieved ${res.data.data.length} movies (>= 15)`);
      }

      // 2. GET movie by ID
      {
        const res = await request('/movies/1');
        assert(res.status === 200, '02. GET /movies/1 returns 200 OK');
        assert(res.data.data.id === 1, '02. Correct movie ID 1 returned');
        assert(res.data.data.title === 'Inception', '02. Movie title is Inception');
      }

      // 3. Search movies using search_q
      {
        const res = await request('/movies?search_q=Avatar');
        assert(res.status === 200, '03. GET /movies?search_q=Avatar returns 200 OK');
        assert(res.data.data.length > 0, '03. Found matching movie');
        assert(res.data.data.every(m => m.title.toLowerCase().includes('avatar')), '03. All returned movies contain Avatar');
      }

      // 4. Search and sort together
      {
        const res = await request('/movies?search_q=The&order_by=rating&order=DESC');
        assert(res.status === 200, '04. GET /movies?search_q=The&order_by=rating&order=DESC returns 200 OK');
        assert(res.data.data.length > 1, '04. Found multiple movies with "The"');
        const ratings = res.data.data.map(m => m.rating);
        assert(ratings[0] >= ratings[1], '04. Results are sorted by rating DESC');
      }

      // 5. Sort ascending by ticket price
      {
        const res = await request('/movies?order_by=ticket_price&order=ASC');
        assert(res.status === 200, '05. GET /movies?order_by=ticket_price&order=ASC returns 200 OK');
        const prices = res.data.data.map(m => m.ticket_price);
        let isSorted = true;
        for (let i = 0; i < prices.length - 1; i++) {
          if (prices[i] > prices[i + 1]) isSorted = false;
        }
        assert(isSorted, '05. Prices are in ascending order');
      }

      // 6. Sort descending by rating
      {
        const res = await request('/movies?order_by=rating&order=DESC');
        assert(res.status === 200, '06. GET /movies?order_by=rating&order=DESC returns 200 OK');
        const ratings = res.data.data.map(m => m.rating);
        let isSorted = true;
        for (let i = 0; i < ratings.length - 1; i++) {
          if (ratings[i] < ratings[i + 1]) isSorted = false;
        }
        assert(isSorted, '06. Ratings are in descending order');
      }

      // 7. Limit movies
      {
        const res = await request('/movies?limit=5');
        assert(res.status === 200, '07. GET /movies?limit=5 returns 200 OK');
        assert(res.data.data.length === 5, '07. Returned exactly 5 movies');
      }

      // 8. Pagination (limit + offset)
      {
        const resAll = await request('/movies?limit=10&offset=0');
        const resPaged = await request('/movies?limit=5&offset=5');
        assert(resPaged.status === 200, '08. GET /movies?limit=5&offset=5 returns 200 OK');
        assert(resPaged.data.data.length === 5, '08. Returned 5 movies');
        assert(resPaged.data.data[0].id === resAll.data.data[5].id, '08. Offset skipped 5 movies correctly');
      }

      // 9. Minimum ticket price
      {
        const res = await request('/movies?min_price=220');
        assert(res.status === 200, '09. GET /movies?min_price=220 returns 200 OK');
        assert(res.data.data.every(m => m.ticket_price >= 220), '09. All ticket prices are >= 220');
      }

      // 10. Maximum ticket price
      {
        const res = await request('/movies?max_price=200');
        assert(res.status === 200, '10. GET /movies?max_price=200 returns 200 OK');
        assert(res.data.data.every(m => m.ticket_price <= 200), '10. All ticket prices are <= 200');
      }

      // 11. Price range filter
      {
        const res = await request('/movies?min_price=180&max_price=250');
        assert(res.status === 200, '11. GET /movies?min_price=180&max_price=250 returns 200 OK');
        assert(res.data.data.every(m => m.ticket_price >= 180 && m.ticket_price <= 250), '11. All ticket prices between 180 and 250');
      }

      // 12. Combined query parameters
      {
        const res = await request('/movies?search_q=The&order_by=ticket_price&order=ASC&limit=2&offset=0&min_price=100&max_price=400');
        assert(res.status === 200, '12a. Combined query returns 200 OK');
        assert(res.data.data.length <= 2, '12a. Limit applied correctly');
      }

      // 13. POST: Add a new movie
      let createdMovieId;
      {
        const newMovie = {
          title: 'Oppenheimer',
          director: 'Christopher Nolan',
          genre: 'Drama',
          release_year: 2023,
          rating: 8.9,
          ticket_price: 280.0
        };
        const res = await request('/movies', { method: 'POST', body: newMovie });
        assert(res.status === 201, '12b. POST /movies returns 201 Created');
        assert(res.data.message === 'Movie added successfully', '12b. Message is Movie added successfully');
        assert(typeof res.data.movieId === 'number', '12b. Returned numeric movieId');
        createdMovieId = res.data.movieId;
      }

      // 14. PUT: Update an existing movie
      {
        const updatedDetails = {
          title: 'Oppenheimer (IMAX Edition)',
          director: 'Christopher Nolan',
          genre: 'Biography',
          release_year: 2023,
          rating: 9.1,
          ticket_price: 350.0
        };
        const res = await request(`/movies/${createdMovieId}`, { method: 'PUT', body: updatedDetails });
        assert(res.status === 200, '13. PUT /movies/:movieId returns 200 OK');
        assert(res.data.message === 'Movie updated successfully', '13. Message is Movie updated successfully');
        assert(res.data.data.title === 'Oppenheimer (IMAX Edition)', '13. Title successfully updated');
        assert(res.data.data.ticket_price === 350.0, '13. Ticket price updated');
      }

      // 15. DELETE: Delete an existing movie
      {
        const res = await request(`/movies/${createdMovieId}`, { method: 'DELETE' });
        assert(res.status === 200, '14. DELETE /movies/:movieId returns 200 OK');
        assert(res.data.message === 'Movie deleted successfully', '14. Message is Movie deleted successfully');

        // Confirm deleted movie returns 404
        const verifyRes = await request(`/movies/${createdMovieId}`);
        assert(verifyRes.status === 404, '14. Verify deleted movie returns 404 Not Found');
      }

      console.log('\n=== TEST SUITE 3: INPUT VALIDATION & FAILURE CASES ===');
      // POST validation failure: missing title
      {
        const res = await request('/movies', {
          method: 'POST',
          body: { director: 'Nolan', genre: 'Sci-Fi', release_year: 2020, rating: 8, ticket_price: 200 }
        });
        assert(res.status === 400, 'POST without title returns 400');
        assert(res.data.message.includes('title is required'), 'Error mentions title is required');
      }

      // POST validation failure: missing director
      {
        const res = await request('/movies', {
          method: 'POST',
          body: { title: 'Test Movie', genre: 'Sci-Fi', release_year: 2020, rating: 8, ticket_price: 200 }
        });
        assert(res.status === 400, 'POST without director returns 400');
        assert(res.data.message.includes('Director is required'), 'Error mentions Director is required');
      }

      // POST validation failure: invalid ticket price (negative)
      {
        const res = await request('/movies', {
          method: 'POST',
          body: { title: 'Test Movie', director: 'Director', genre: 'Action', release_year: 2020, rating: 8, ticket_price: -50 }
        });
        assert(res.status === 400, 'POST with negative ticket price returns 400');
      }

      // POST validation failure: non-numeric ticket price string
      {
        const res = await request('/movies', {
          method: 'POST',
          body: { title: 'Test Movie', director: 'Director', genre: 'Action', release_year: 2020, rating: 8, ticket_price: 'free' }
        });
        assert(res.status === 400, 'POST with string ticket price "free" returns 400');
      }

      // POST validation failure: rating > 10
      {
        const res = await request('/movies', {
          method: 'POST',
          body: { title: 'Test Movie', director: 'Director', genre: 'Action', release_year: 2020, rating: 11.5, ticket_price: 150 }
        });
        assert(res.status === 400, 'POST with rating > 10 returns 400');
      }

      // GET failure: invalid movie ID format
      {
        const res = await request('/movies/invalid-id');
        assert(res.status === 400, 'GET /movies/invalid-id returns 400 Bad Request');
      }

      // GET failure: non-existent movie ID
      {
        const res = await request('/movies/99999');
        assert(res.status === 404, 'GET /movies/99999 returns 404 Not Found');
      }

      // GET query failure: invalid order_by column
      {
        const res = await request('/movies?order_by=hacked_column');
        assert(res.status === 400, 'GET /movies?order_by=hacked_column returns 400 Bad Request');
        assert(res.data.message.includes('Invalid order_by column'), 'Error mentions allowed columns');
      }

      // GET query failure: invalid order direction
      {
        const res = await request('/movies?order=SIDEWAYS');
        assert(res.status === 400, 'GET /movies?order=SIDEWAYS returns 400 Bad Request');
      }

      // GET query failure: invalid limit
      {
        const res = await request('/movies?limit=-1');
        assert(res.status === 400, 'GET /movies?limit=-1 returns 400 Bad Request');
      }

      // GET query failure: invalid offset
      {
        const res = await request('/movies?offset=-5');
        assert(res.status === 400, 'GET /movies?offset=-5 returns 400 Bad Request');
      }

      // GET query failure: min_price > max_price
      {
        const res = await request('/movies?min_price=300&max_price=100');
        assert(res.status === 400, 'GET /movies?min_price=300&max_price=100 returns 400 Bad Request');
        assert(res.data.message.includes('min_price cannot be greater than max_price'), 'Error warns min_price > max_price');
      }

      // PUT failure: update non-existent movie ID
      {
        const res = await request('/movies/99999', {
          method: 'PUT',
          body: { title: 'Ghost', director: 'Nobody', genre: 'Mystery', release_year: 2020, rating: 5, ticket_price: 100 }
        });
        assert(res.status === 404, 'PUT /movies/99999 returns 404 Not Found');
      }

      // DELETE failure: delete non-existent movie ID
      {
        const res = await request('/movies/99999', { method: 'DELETE' });
        assert(res.status === 404, 'DELETE /movies/99999 returns 404 Not Found');
      }

      // 404 catch-all route
      {
        const res = await request('/non-existent-endpoint');
        assert(res.status === 404, 'GET /non-existent-endpoint returns 404');
      }

      console.log(`\n========================================`);
      console.log(`TOTAL TESTS: ${passed + failed}`);
      console.log(`PASSED: ${passed}`);
      console.log(`FAILED: ${failed}`);
      console.log(`========================================\n`);

      server.close();
      if (failed > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    } catch (err) {
      console.error('Test execution error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runTests();
