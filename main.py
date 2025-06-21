import pandas as pd
from flask import Flask, render_template, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pickle
import requests
import re # Keep re for sentiment prediction
# from bs4 import BeautifulSoup # Removed: No longer scraping
import nltk
from nltk.corpus import stopwords
from nltk.stem.porter import PorterStemmer
import time
import os


# --- Download NLTK data (if not present) ---
print("Checking and downloading NLTK data (if not present)...")
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')
    print("NLTK 'stopwords' downloaded.")

try:
    nltk.data.find('sentiment/vader_lexicon')
except LookupError:
    nltk.download('vader_lexicon')
    print("NLTK 'vader_lexicon' downloaded.")
print("NLTK data check complete.")

# Initialize Flask app
app = Flask(__name__)

# --- Configuration ---
# IMPORTANT: Replace with your actual TMDb API Key
TMDB_API_KEY = '84e5de76a36aa739e089fbcd4d63a0e9'

# --- Load Data and Models (Global for efficiency) ---
df = None
cosine_sim = None
nlp_model = None
tfidf_vectorizer_sentiment = None
movies = pd.Series()
indices = pd.Series()

try:
    # Load the preprocessed movie data
    df = pd.read_csv('main_data.csv')
    print("main_data.csv loaded successfully.")

    # Fill any NaN values in the 'comb' column with an empty string
    df['comb'] = df['comb'].fillna('')

    # Create TfidfVectorizer and cosine similarity matrix for movie recommendations
    print("Creating TfidfVectorizer and cosine similarity matrix for recommendations...")
    cv_recommendation = TfidfVectorizer(stop_words='english')
    count_matrix = cv_recommendation.fit_transform(df['comb'])
    cosine_sim = cosine_similarity(count_matrix)
    print("TfidfVectorizer and cosine similarity matrix for recommendations created.")

    # Create a Series for movie titles (for quick lookup by index)
    movies = pd.Series(df['movie_title'])
    # Create a reverse mapping for movie titles to indices
    indices = pd.Series(df.index, index=df['movie_title']).drop_duplicates()
    print("Movie titles and indices loaded.")

    # Load the pre-trained NLP model and TF-IDF vectorizer for sentiment analysis
    with open('nlp_model.pkl', 'rb') as file:
        nlp_model = pickle.load(file)
    with open('tranform.pkl', 'rb') as file:
        tfidf_vectorizer_sentiment = pickle.load(file)
    print("NLP model and TF-IDF vectorizer for sentiment loaded successfully.")

except FileNotFoundError as e:
    print(f"Error loading required files: {e}. Make sure 'main_data.csv', 'nlp_model.pkl', and 'tranform.pkl' are in the same directory as main.py.")
    print("If 'nlp_model.pkl' and 'tranform.pkl' are missing, please run 'sentiment.ipynb' first.")
    print("Application will run, but sentiment analysis and recommendations might be limited/unavailable.")
    df = None
    cosine_sim = None
    nlp_model = None
    tfidf_vectorizer_sentiment = None

except MemoryError as e:
    print(f"CRITICAL MemoryError: {e}. The dataset or generated matrix is too large for available RAM.")
    print("This error indicates that even Colab's default RAM might be insufficient. You might need to select a High-RAM runtime (Runtime -> Change runtime type) or proceed with reducing the dataset size if this persists.")
    df = None
    cosine_sim = None
    nlp_model = None
    tfidf_vectorizer_sentiment = None

except Exception as e:
    print(f"An unexpected error occurred during file loading: {e}")
    print("Application will run, but some features might be limited/unavailable.")

# --- Helper Functions ---

# Removed get_imdb_id as IMDb reviews are no longer scraped directly.
# If you still need IMDb ID for other purposes (e.g., links), you'd re-add this.

def fetch_tmdb_reviews(tmdb_movie_id, max_reviews=10):
    """Fetches user reviews from TMDb for a given movie ID."""
    if not tmdb_movie_id:
        return []

    reviews = []
    # TMDb reviews endpoint
    reviews_url = f"https://api.themoviedb.org/3/movie/{tmdb_movie_id}/reviews?api_key={TMDB_API_KEY}&language=en-US"

    try:
        response = requests.get(reviews_url, timeout=10)
        response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        data = response.json()

        for review_data in data.get('results', []):
            if len(reviews) < max_reviews: # Limit the number of reviews fetched
                reviews.append(review_data.get('content'))
            else:
                break # Stop if max_reviews reached
        return reviews
    except requests.exceptions.RequestException as e:
        print(f"Error fetching TMDb reviews for movie ID {tmdb_movie_id}: {e}")
        return []

def predict_sentiment(review_text):
    if nlp_model and tfidf_vectorizer_sentiment:
        review = re.sub('[^a-zA-Z]', ' ', review_text)
        review = review.lower()
        review = review.split()
        ps = PorterStemmer()
        all_stopwords = set(stopwords.words('english'))
        review = [ps.stem(word) for word in review if not word in all_stopwords]
        review = ' '.join(review)
        review_vector = tfidf_vectorizer_sentiment.transform([review]).toarray()
        sentiment_label = nlp_model.predict(review_vector)[0]
        return "Positive" if sentiment_label == 1 else "Negative"
    return "Unknown (Models not loaded)"

# --- Routes ---
@app.route('/')
def home():
    if df is not None and not df.empty:
        all_movie_titles = movies.tolist()
    else:
        all_movie_titles = []
    return render_template('home.html', suggestions=all_movie_titles)

@app.route('/autocomplete')
def autocomplete():
    query = request.args.get('query', '')
    if df is not None and not df.empty:
        suggestions = df[df['movie_title'].str.contains(query, case=False, na=False)]
        suggestions_list = suggestions[['movie_title', 'id', 'poster_path']].to_dict(orient='records')
        return jsonify(suggestions_list[:10])
    return jsonify([])

@app.route('/search_movie_by_title')
def search_movie_by_title():
    title = request.args.get('title', '')
    if df is not None and not df.empty:
        movie_row = df[df['movie_title'].str.lower() == title.lower()]
        if not movie_row.empty:
            movie_id = movie_row.iloc[0]['id']
            poster_path = movie_row.iloc[0]['poster_path']
            return jsonify({'movie_id': movie_id, 'title': title, 'poster_path': poster_path})
    return jsonify({'movie_id': None, 'title': None, 'poster_path': None})

@app.route('/recommend', methods=['POST'])
def recommend():
    if cosine_sim is None or df is None or movies.empty or indices.empty:
        print("Error: Core data or models not loaded for recommendations. Cannot proceed.")
        return "Error: Data or models not loaded. Please check server logs.", 500

    data = request.get_json()
    movie_title = data.get('title')
    poster_path = data.get('poster_path')
    overview = data.get('overview')
    vote_average = data.get('vote_average')
    vote_count = data.get('vote_count')
    genres = data.get('genres')
    release_date = data.get('release_date')
    runtime = data.get('runtime')
    status = data.get('status')
    director = data.get('director')
    cast = data.get('cast')
    budget = data.get('budget')
    revenue = data.get('revenue')
    original_language = data.get('original_language')
    writers = data.get('writers')
    trailer_key = data.get('trailer_key')
    # Assuming the frontend now passes the TMDb ID directly
    tmdb_movie_id = data.get('tmdb_id')


    if movie_title not in indices:
        print(f"Error: Movie title '{movie_title}' not found in dataset indices for recommendations.")
        return "Error: Movie not found in dataset for recommendations.", 404

    idx = indices[movie_title]
    sim_scores = list(enumerate(cosine_sim[idx]))
    sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
    sim_scores = sim_scores[1:11]
    movie_indices = [i[0] for i in sim_scores]

    recommended_movies_data = []
    for i in movie_indices:
        rec_title = movies.iloc[i]
        rec_movie_row = df[df['movie_title'] == rec_title].iloc[0]
        rec_id = rec_movie_row['id']
        rec_poster_path = rec_movie_row['poster_path']
        recommended_movies_data.append({
            'id': rec_id,
            'title': rec_title,
            'poster_url': f"https://image.tmdb.org/t/p/w185{rec_poster_path}" if rec_poster_path else 'https://placehold.co/185x278/CCCCCC/333333?text=No+Image'
        })

    # Pass the TMDb movie ID to the template for the review button
    return render_template('recommend.html',
                           title=movie_title,
                           poster_path=poster_path,
                           overview=overview,
                           vote_average=vote_average,
                           vote_count=vote_count,
                           genres=genres,
                           release_date=release_date,
                           runtime=runtime,
                           status=status,
                           director=director,
                           cast=cast,
                           recommended_movies=recommended_movies_data,
                           tmdb_id=tmdb_movie_id, # Pass TMDb ID here
                           budget=budget,
                           revenue=revenue,
                           original_language=original_language,
                           writers=writers,
                           trailer_key=trailer_key
                           )

@app.route('/get_movie_reviews', methods=['POST']) # Renamed route
def get_movie_reviews():
    data = request.get_json()
    tmdb_id = data.get('tmdb_id') # Expecting tmdb_id now
    
    if not tmdb_id:
        return jsonify({'error': 'TMDb movie ID not provided'}), 400

    reviews_text = fetch_tmdb_reviews(tmdb_id) # Use the new function

    processed_reviews = []
    if nlp_model and tfidf_vectorizer_sentiment:
        for review_text in reviews_text:
            sentiment = predict_sentiment(review_text)
            processed_reviews.append({'text': review_text, 'sentiment': sentiment})
    else:
        print("NLP models (nlp_model.pkl, tranform.pkl) not loaded. Cannot predict sentiment.")
        for review_text in reviews_text:
            processed_reviews.append({'text': review_text, 'sentiment': 'Unknown (Models not loaded)'})

    return jsonify({'reviews': processed_reviews})

if __name__ == '__main__':
    app.run(debug=True)