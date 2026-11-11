const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// Allow custom database path via environment variable (crucial for Render persistent disks)
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'movies.db');

let dbInstance = null;

const sampleMovies = [
  { title: 'Inception', director: 'Christopher Nolan', genre: 'Sci-Fi', release_year: 2010, rating: 8.8, ticket_price: 250.0 },
  { title: 'The Dark Knight', director: 'Christopher Nolan', genre: 'Action', release_year: 2008, rating: 9.0, ticket_price: 280.0 },
  { title: 'Interstellar', director: 'Christopher Nolan', genre: 'Sci-Fi', release_year: 2014, rating: 8.7, ticket_price: 260.0 },
  { title: 'Parasite', director: 'Bong Joon-ho', genre: 'Thriller', release_year: 2019, rating: 8.5, ticket_price: 220.0 },
  { title: 'The Shawshank Redemption', director: 'Frank Darabont', genre: 'Drama', release_year: 1994, rating: 9.3, ticket_price: 200.0 },
  { title: 'Pulp Fiction', director: 'Quentin Tarantino', genre: 'Thriller', release_year: 1994, rating: 8.9, ticket_price: 210.0 },
  { title: 'The Godfather', director: 'Francis Ford Coppola', genre: 'Drama', release_year: 1972, rating: 9.2, ticket_price: 240.0 },
  { title: 'Forrest Gump', director: 'Robert Zemeckis', genre: 'Drama', release_year: 1994, rating: 8.8, ticket_price: 190.0 },
  { title: '3 Idiots', director: 'Rajkumar Hirani', genre: 'Comedy', release_year: 2009, rating: 8.4, ticket_price: 180.0 },
  { title: 'Dangal', director: 'Nitesh Tiwari', genre: 'Drama', release_year: 2016, rating: 8.3, ticket_price: 200.0 },
  { title: 'Spider-Man: Into the Spider-Verse', director: 'Bob Persichetti', genre: 'Action', release_year: 2018, rating: 8.4, ticket_price: 220.0 },
  { title: 'Avengers: Endgame', director: 'Anthony Russo, Joe Russo', genre: 'Action', release_year: 2019, rating: 8.4, ticket_price: 300.0 },
  { title: 'La La Land', director: 'Damien Chazelle', genre: 'Romance', release_year: 2016, rating: 8.0, ticket_price: 190.0 },
  { title: 'Titanic', director: 'James Cameron', genre: 'Romance', release_year: 1997, rating: 7.9, ticket_price: 230.0 },
  { title: 'Avatar', director: 'James Cameron', genre: 'Sci-Fi', release_year: 2009, rating: 7.9, ticket_price: 270.0 },
  { title: 'The Grand Budapest Hotel', director: 'Wes Anderson', genre: 'Comedy', release_year: 2014, rating: 8.1, ticket_price: 170.0 },
  { title: 'The Hangover', director: 'Todd Phillips', genre: 'Comedy', release_year: 2009, rating: 7.7, ticket_price: 160.0 },
  { title: 'Shutter Island', director: 'Martin Scorsese', genre: 'Thriller', release_year: 2010, rating: 8.2, ticket_price: 210.0 }
];

async function initializeDB() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log(`Connected to SQLite database at: ${dbPath}`);

    // Create 'movie' table if it doesn't already exist
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS movie (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        director TEXT NOT NULL,
        genre TEXT NOT NULL,
        release_year INTEGER,
        rating REAL,
        ticket_price REAL NOT NULL
      );
    `);

    // Idempotent seeding: Only insert sample data if table is currently empty
    const countResult = await dbInstance.get('SELECT COUNT(*) AS count FROM movie;');
    if (countResult && countResult.count === 0) {
      console.log('Seeding initial movie records into database...');
      const insertSql = `
        INSERT INTO movie (title, director, genre, release_year, rating, ticket_price)
        VALUES (?, ?, ?, ?, ?, ?);
      `;

      for (const movie of sampleMovies) {
        await dbInstance.run(insertSql, [
          movie.title,
          movie.director,
          movie.genre,
          movie.release_year,
          movie.rating,
          movie.ticket_price
        ]);
      }
      console.log(`Seeded ${sampleMovies.length} realistic movie records successfully.`);
    } else {
      console.log(`Database already contains ${countResult.count} movie records. Seeding skipped.`);
    }

    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    throw error;
  }
}

function getDB() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Please call initializeDB() first.');
  }
  return dbInstance;
}

module.exports = {
  initializeDB,
  getDB,
  dbPath
};
