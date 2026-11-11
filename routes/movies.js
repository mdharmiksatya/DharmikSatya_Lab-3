const express = require('express');
const router = express.Router();
const { getDB } = require('../database/database');

// Allowlist of safe columns for ORDER BY (strictly prevents SQL injection)
const ALLOWED_ORDER_BY = [
  'id',
  'title',
  'director',
  'genre',
  'release_year',
  'rating',
  'ticket_price'
];

// Allowlist of sorting directions
const ALLOWED_ORDER_DIR = ['ASC', 'DESC'];

/**
 * Helper to validate positive integer ID
 */
function parseValidId(idParam) {
  const parsed = parseInt(idParam, 10);
  if (isNaN(parsed) || parsed <= 0 || String(parsed) !== String(idParam).trim()) {
    return null;
  }
  return parsed;
}

/**
 * GET /movies
 * Retrieve movies with search, order_by, order, limit, offset, min_price, max_price, genre, release_year
 */
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const {
      search_q,
      order_by = 'id',
      order = 'ASC',
      limit,
      offset,
      min_price,
      max_price,
      genre,
      release_year
    } = req.query;

    // 1. Validate order_by against allowlist
    const normalizedOrderBy = String(order_by).toLowerCase();
    if (!ALLOWED_ORDER_BY.includes(normalizedOrderBy)) {
      return res.status(400).json({
        message: `Invalid order_by column. Allowed columns: ${ALLOWED_ORDER_BY.join(', ')}`
      });
    }

    // 2. Validate order direction against allowlist
    const normalizedOrderDir = String(order).toUpperCase();
    if (!ALLOWED_ORDER_DIR.includes(normalizedOrderDir)) {
      return res.status(400).json({
        message: 'Invalid order direction. Allowed values: ASC, DESC'
      });
    }

    // 3. Validate pagination parameters (if provided)
    let parsedLimit = null;
    let parsedOffset = null;

    if (limit !== undefined || offset !== undefined) {
      const rawLimit = limit !== undefined ? limit : '10';
      const rawOffset = offset !== undefined ? offset : '0';

      parsedLimit = parseInt(rawLimit, 10);
      parsedOffset = parseInt(rawOffset, 10);

      if (isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100 || String(parsedLimit) !== String(rawLimit).trim()) {
        return res.status(400).json({
          message: 'Invalid limit parameter. Limit must be an integer between 1 and 100.'
        });
      }

      if (isNaN(parsedOffset) || parsedOffset < 0 || String(parsedOffset) !== String(rawOffset).trim()) {
        return res.status(400).json({
          message: 'Invalid offset parameter. Offset must be a non-negative integer.'
        });
      }
    }

    // 4. Validate price filters
    let parsedMinPrice = null;
    let parsedMaxPrice = null;

    if (min_price !== undefined) {
      if (typeof min_price !== 'string' || min_price.trim() === '' || isNaN(Number(min_price)) || Number(min_price) < 0) {
        return res.status(400).json({
          message: 'Invalid min_price parameter. min_price must be a valid non-negative number.'
        });
      }
      parsedMinPrice = parseFloat(min_price);
    }

    if (max_price !== undefined) {
      if (typeof max_price !== 'string' || max_price.trim() === '' || isNaN(Number(max_price)) || Number(max_price) < 0) {
        return res.status(400).json({
          message: 'Invalid max_price parameter. max_price must be a valid non-negative number.'
        });
      }
      parsedMaxPrice = parseFloat(max_price);
    }

    if (parsedMinPrice !== null && parsedMaxPrice !== null && parsedMinPrice > parsedMaxPrice) {
      return res.status(400).json({
        message: 'Invalid price range. min_price cannot be greater than max_price'
      });
    }

    // 5. Construct parameterized SQL query
    const whereConditions = [];
    const queryParams = [];

    // Search partial movie title using SQL LIKE
    if (search_q !== undefined && search_q.trim() !== '') {
      whereConditions.push('title LIKE ?');
      queryParams.push(`%${search_q.trim()}%`);
    }

    // Price filtering
    if (parsedMinPrice !== null && parsedMaxPrice !== null) {
      whereConditions.push('ticket_price BETWEEN ? AND ?');
      queryParams.push(parsedMinPrice, parsedMaxPrice);
    } else if (parsedMinPrice !== null) {
      whereConditions.push('ticket_price >= ?');
      queryParams.push(parsedMinPrice);
    } else if (parsedMaxPrice !== null) {
      whereConditions.push('ticket_price <= ?');
      queryParams.push(parsedMaxPrice);
    }

    // Optional genre filter
    if (genre !== undefined && genre.trim() !== '') {
      whereConditions.push('LOWER(genre) = LOWER(?)');
      queryParams.push(genre.trim());
    }

    // Optional release_year filter
    if (release_year !== undefined && release_year.trim() !== '') {
      const year = parseInt(release_year, 10);
      if (isNaN(year) || year < 1888 || year > 2100) {
        return res.status(400).json({
          message: 'Invalid release_year parameter. Must be a valid year between 1888 and 2100.'
        });
      }
      whereConditions.push('release_year = ?');
      queryParams.push(year);
    }

    let sqlQuery = 'SELECT * FROM movie';
    if (whereConditions.length > 0) {
      sqlQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Apply sorting
    sqlQuery += ` ORDER BY ${normalizedOrderBy} ${normalizedOrderDir}`;

    // Apply pagination if specified
    if (parsedLimit !== null && parsedOffset !== null) {
      sqlQuery += ' LIMIT ? OFFSET ?';
      queryParams.push(parsedLimit, parsedOffset);
    }

    const movies = await db.all(sqlQuery, queryParams);

    return res.status(200).json({
      message: 'Movies retrieved successfully',
      total: movies.length,
      data: movies
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Internal server error while retrieving movies',
      error: error.message
    });
  }
});

/**
 * GET /movies/:movieId
 * Retrieve a single movie by its ID
 */
router.get('/:movieId', async (req, res) => {
  try {
    const db = getDB();
    const movieId = parseValidId(req.params.movieId);

    if (!movieId) {
      return res.status(400).json({
        message: 'Invalid movie ID. ID must be a valid positive integer.'
      });
    }

    const movie = await db.get('SELECT * FROM movie WHERE id = ?;', [movieId]);

    if (!movie) {
      return res.status(404).json({
        message: 'Movie not found'
      });
    }

    return res.status(200).json({
      message: 'Movie retrieved successfully',
      data: movie
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Internal server error while retrieving movie',
      error: error.message
    });
  }
});

/**
 * POST /movies
 * Add a new movie to the database
 */
router.post('/', async (req, res) => {
  try {
    const db = getDB();
    const { title, director, genre, release_year, rating, ticket_price } = req.body;

    // 1. Movie title validation
    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({
        message: 'Movie title is required and cannot be empty.'
      });
    }

    // 2. Director validation
    if (typeof director !== 'string' || director.trim() === '') {
      return res.status(400).json({
        message: 'Director is required and cannot be empty.'
      });
    }

    // 3. Genre validation
    if (typeof genre !== 'string' || genre.trim() === '') {
      return res.status(400).json({
        message: 'Genre is required and cannot be empty.'
      });
    }

    // 4. Release year validation
    if (
      release_year === undefined ||
      release_year === null ||
      release_year === '' ||
      typeof release_year === 'boolean' ||
      isNaN(Number(release_year)) ||
      !Number.isInteger(Number(release_year)) ||
      Number(release_year) < 1888 ||
      Number(release_year) > 2100
    ) {
      return res.status(400).json({
        message: 'Release year must be a valid integer year between 1888 and 2100.'
      });
    }

    // 5. Rating validation (0 - 10)
    if (
      rating === undefined ||
      rating === null ||
      rating === '' ||
      typeof rating === 'boolean' ||
      isNaN(Number(rating)) ||
      Number(rating) < 0 ||
      Number(rating) > 10
    ) {
      return res.status(400).json({
        message: 'Rating must be a valid number within the range 0 to 10.'
      });
    }

    // 6. Ticket price validation (non-negative number)
    if (
      ticket_price === undefined ||
      ticket_price === null ||
      ticket_price === '' ||
      typeof ticket_price === 'boolean' ||
      isNaN(Number(ticket_price)) ||
      Number(ticket_price) < 0
    ) {
      return res.status(400).json({
        message: 'Ticket price must be a valid non-negative number.'
      });
    }

    const parsedYear = parseInt(release_year, 10);
    const parsedRating = parseFloat(rating);
    const parsedTicketPrice = parseFloat(ticket_price);

    const insertSql = `
      INSERT INTO movie (title, director, genre, release_year, rating, ticket_price)
      VALUES (?, ?, ?, ?, ?, ?);
    `;

    const result = await db.run(insertSql, [
      title.trim(),
      director.trim(),
      genre.trim(),
      parsedYear,
      parsedRating,
      parsedTicketPrice
    ]);

    const createdMovie = {
      id: result.lastID,
      title: title.trim(),
      director: director.trim(),
      genre: genre.trim(),
      release_year: parsedYear,
      rating: parsedRating,
      ticket_price: parsedTicketPrice
    };

    return res.status(201).json({
      message: 'Movie added successfully',
      movieId: result.lastID,
      data: createdMovie
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Internal server error while adding movie',
      error: error.message
    });
  }
});

/**
 * PUT /movies/:movieId
 * Update an existing movie
 */
router.put('/:movieId', async (req, res) => {
  try {
    const db = getDB();
    const movieId = parseValidId(req.params.movieId);

    if (!movieId) {
      return res.status(400).json({
        message: 'Invalid movie ID. ID must be a valid positive integer.'
      });
    }

    // Check if movie exists
    const existingMovie = await db.get('SELECT * FROM movie WHERE id = ?;', [movieId]);
    if (!existingMovie) {
      return res.status(404).json({
        message: 'Movie not found'
      });
    }

    const { title, director, genre, release_year, rating, ticket_price } = req.body;

    // 1. Movie title validation
    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({
        message: 'Movie title is required and cannot be empty.'
      });
    }

    // 2. Director validation
    if (typeof director !== 'string' || director.trim() === '') {
      return res.status(400).json({
        message: 'Director is required and cannot be empty.'
      });
    }

    // 3. Genre validation
    if (typeof genre !== 'string' || genre.trim() === '') {
      return res.status(400).json({
        message: 'Genre is required and cannot be empty.'
      });
    }

    // 4. Release year validation
    if (
      release_year === undefined ||
      release_year === null ||
      release_year === '' ||
      typeof release_year === 'boolean' ||
      isNaN(Number(release_year)) ||
      !Number.isInteger(Number(release_year)) ||
      Number(release_year) < 1888 ||
      Number(release_year) > 2100
    ) {
      return res.status(400).json({
        message: 'Release year must be a valid integer year between 1888 and 2100.'
      });
    }

    // 5. Rating validation (0 - 10)
    if (
      rating === undefined ||
      rating === null ||
      rating === '' ||
      typeof rating === 'boolean' ||
      isNaN(Number(rating)) ||
      Number(rating) < 0 ||
      Number(rating) > 10
    ) {
      return res.status(400).json({
        message: 'Rating must be a valid number within the range 0 to 10.'
      });
    }

    // 6. Ticket price validation (non-negative number)
    if (
      ticket_price === undefined ||
      ticket_price === null ||
      ticket_price === '' ||
      typeof ticket_price === 'boolean' ||
      isNaN(Number(ticket_price)) ||
      Number(ticket_price) < 0
    ) {
      return res.status(400).json({
        message: 'Ticket price must be a valid non-negative number.'
      });
    }

    const parsedYear = parseInt(release_year, 10);
    const parsedRating = parseFloat(rating);
    const parsedTicketPrice = parseFloat(ticket_price);

    const updateSql = `
      UPDATE movie
      SET title = ?, director = ?, genre = ?, release_year = ?, rating = ?, ticket_price = ?
      WHERE id = ?;
    `;

    await db.run(updateSql, [
      title.trim(),
      director.trim(),
      genre.trim(),
      parsedYear,
      parsedRating,
      parsedTicketPrice,
      movieId
    ]);

    const updatedMovie = {
      id: movieId,
      title: title.trim(),
      director: director.trim(),
      genre: genre.trim(),
      release_year: parsedYear,
      rating: parsedRating,
      ticket_price: parsedTicketPrice
    };

    return res.status(200).json({
      message: 'Movie updated successfully',
      data: updatedMovie
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Internal server error while updating movie',
      error: error.message
    });
  }
});

/**
 * DELETE /movies/:movieId
 * Delete an existing movie
 */
router.delete('/:movieId', async (req, res) => {
  try {
    const db = getDB();
    const movieId = parseValidId(req.params.movieId);

    if (!movieId) {
      return res.status(400).json({
        message: 'Invalid movie ID. ID must be a valid positive integer.'
      });
    }

    // Check if movie exists
    const existingMovie = await db.get('SELECT * FROM movie WHERE id = ?;', [movieId]);
    if (!existingMovie) {
      return res.status(404).json({
        message: 'Movie not found'
      });
    }

    await db.run('DELETE FROM movie WHERE id = ?;', [movieId]);

    return res.status(200).json({
      message: 'Movie deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Internal server error while deleting movie',
      error: error.message
    });
  }
});

module.exports = router;
