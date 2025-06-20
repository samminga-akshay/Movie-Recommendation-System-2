import pandas as pd
import requests
import time
from tqdm import tqdm # For progress bar
from requests.exceptions import ConnectionError, Timeout, HTTPError
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# --- Configuration ---
TMDB_API_KEY = '84e5de76a36aa739e089fbcd4d63a0e9' # REPLACE WITH YOUR ACTUAL TMDB API KEY
START_YEAR = 2010 # Start fetching movies from this year
END_YEAR = 2025   # Fetch movies up to this year (inclusive)
OUTPUT_FILE = 'main_data.csv'
BASE_SLEEP_TIME = 1.0 # Increased sleep time even more
MAX_RETRIES = 10      # Increased max retries for the session
BACKOFF_FACTOR = 0.5  # Factor for exponential backoff (retry delay = backoff_factor * (2 ** (attempt - 1)))
STATUS_FORCELIST = [429, 500, 502, 503, 504] # HTTP status codes to retry on
MAX_API_PAGES = 10 # Crucial: TMDb's discover endpoint often caps at 500 pages

# --- Setup Requests Session with Retries ---
def requests_retry_session(
    retries=MAX_RETRIES,
    backoff_factor=BACKOFF_FACTOR,
    status_forcelist=STATUS_FORCELIST,
    session=None,
):
    session = session or requests.Session()
    retry = Retry(
        total=retries,
        read=retries,
        connect=retries,
        backoff_factor=backoff_factor,
        status_forcelist=status_forcelist,
        
        # 'allowed_methods' is not supported in urllib3 versions < 1.26.0
        # Removing it to fix TypeError
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    return session

# --- Helper Functions for TMDb API ---

def get_genres(genre_ids):
    """Converts a list of genre IDs to genre names."""
    genre_map = {
        28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
        99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
        27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
        10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
    }
    return [genre_map.get(gid, 'Unknown') for gid in genre_ids]

# Using the global session with retries
session = requests_retry_session()

def make_api_request(url):
    """Makes an API request using the configured session with retries."""
    try:
        response = session.get(url, timeout=20) # Increased timeout for session
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        return response.json()
    except (ConnectionError, Timeout, HTTPError) as e:
        print(f"Failed to fetch {url} after retries: {type(e).__name__}: {e}") # More detailed error
        return None
    except Exception as e:
        print(f"An unexpected error occurred for {url}: {type(e).__name__}: {e}") # More detailed error
        return None

def get_movie_details(movie_id):
    """Fetches full details for a given movie ID."""
    url = f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={TMDB_API_KEY}&append_to_response=credits,keywords"
    return make_api_request(url)

def get_movies_by_year(year):
    """Fetches movies released in a given year."""
    movies_data = []
    page = 1
    total_pages = 1 # Initialize to enter the loop

    print(f"Fetching movies for year: {year}")
    with tqdm(total=total_pages, desc=f"Year {year} Pages") as pbar:
        while page <= total_pages:
            # Crucial: Limit page to MAX_API_PAGES
            if page > MAX_API_PAGES:
                print(f"Reached page limit ({MAX_API_PAGES}) for year {year}. Stopping further page fetches for this year.")
                break # Exit the loop for this year
            
            url = f"https://api.themoviedb.org/3/discover/movie?api_key={TMDB_API_KEY}&sort_by=popularity.desc&primary_release_year={year}&page={page}"
            data = make_api_request(url)

            if data:
                # Update total_pages, but cap it at MAX_API_PAGES if it's higher
                total_pages = min(data['total_pages'], MAX_API_PAGES) 
                
                # Update tqdm total if it's the first page
                if page == 1:
                    pbar.total = total_pages
                
                for movie in data['results']:
                    full_details = get_movie_details(movie['id'])
                    if full_details:
                        genres = get_genres([g['id'] for g in full_details.get('genres', [])])
                        
                        # Extract top 3 cast members
                        cast_names = [c['name'] for c in full_details.get('credits', {}).get('cast', [])[:3]]
                        
                        # Extract director
                        director_name = next((crew['name'] for crew in full_details.get('credits', {}).get('crew', []) if crew['job'] == 'Director'), None)
                        
                        # Extract keywords
                        keywords = [k['name'] for k in full_details.get('keywords', {}).get('keywords', [])]

                        movies_data.append({
                            'movie_title': full_details.get('title'),
                            'director_name': director_name,
                            'actor_1_name': cast_names[0] if len(cast_names) > 0 else None,
                            'actor_2_name': cast_names[1] if len(cast_names) > 1 else None,
                            'actor_3_name': cast_names[2] if len(cast_names) > 2 else None,
                            'genres': " ".join(genres), # Join genres for 'comb' column
                            'keywords': " ".join(keywords), # Join keywords for 'comb' column
                            'id': movie['id'], # Add TMDb ID for later use in main.py/recommend.js
                            'poster_path': movie['poster_path'] # Add poster path for later use
                        })
                page += 1
                pbar.update(1) # Update progress bar for each page
                time.sleep(BASE_SLEEP_TIME) # Be kind to the API
            else:
                print(f"Could not fetch page {page} for year {year}. Moving to next page/year.")
                page += 1 # Still increment page to avoid infinite loop on persistent error for one page
                time.sleep(BASE_SLEEP_TIME * 5) # Longer sleep if page fails
    return movies_data

# --- Main Execution ---
if __name__ == '__main__':
    # Test API connection first
    print("Testing TMDb API connection...")
    test_url = f"https://api.themoviedb.org/3/configuration?api_key={TMDB_API_KEY}"
    test_response = make_api_request(test_url)
    if test_response:
        print("TMDb API connection successful!")
    else:
        print("TMDb API connection FAILED. Please check your API key and internet connection.")
        # Exit if connection fails at the start
        exit() 

    all_movies_data = []
    for year in range(START_YEAR, END_YEAR + 1):
        movies_for_year = get_movies_by_year(year)
        all_movies_data.extend(movies_for_year)

    if all_movies_data:
        df = pd.DataFrame(all_movies_data)
        
        # Fill NaN values with empty strings for combination
        df = df.fillna('')

        # Create the 'comb' column
        df['comb'] = (
            df['director_name'].astype(str) + ' ' +
            df['actor_1_name'].astype(str) + ' ' +
            df['actor_2_name'].astype(str) + ' ' +
            df['actor_3_name'].astype(str) + ' ' +
            df['genres'].astype(str) + ' ' +
            df['keywords'].astype(str)
        ).str.lower().str.strip() # Convert to lowercase and strip whitespace
 
        # Drop duplicates based on movie title
        df.drop_duplicates(subset='movie_title', inplace=True)
        
        # Save the DataFrame to CSV
        df.to_csv(OUTPUT_FILE, index=False)
        print(f"\nSuccessfully created {OUTPUT_FILE} with {len(df)} movies from {START_YEAR} to {END_YEAR}.")
    else:
        print("No movie data fetched. Please check your API key, internet connection, and TMDb API status.")

