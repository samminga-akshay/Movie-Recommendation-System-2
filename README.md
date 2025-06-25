# Movie Recommendation System with Sentiment Analysis

## 1. Project Overview

This project implements a web-based movie recommendation system that leverages content-based filtering and integrates sentiment analysis of user reviews. The system allows users to search for movies, get detailed information, receive personalized movie recommendations based on content similarity, and view the sentiment (positive/negative) of aggregated user reviews fetched from TMDb.

## 2. Key Features

* **Movie Search:** Search for movies by title with an autocomplete feature.
* **Detailed Movie Information:** Display comprehensive details about a selected movie including plot overview, genre, release date, cast, director, budget, revenue, and a trailer (if available).
* **Content-Based Recommendations:** Generate recommendations for similar movies based on their combined features (genres, keywords, cast, crew).
* **TMDb Review Integration:** Fetch real-time user reviews directly from The Movie Database (TMDb).
* **Sentiment Analysis:** Predicts the sentiment (positive or negative) of fetched user reviews using a pre-trained machine learning model.

## 3. Architecture and Technology Stack

The system is built using a Python Flask backend for serving the web application and handling data processing, recommendations, and sentiment analysis. The frontend is powered by HTML, CSS, and JavaScript (jQuery) for an interactive user interface.

* **Backend:** Python 3, Flask
* **Machine Learning:** `scikit-learn` for TF-IDF vectorization and Cosine Similarity, `nltk` for text processing, and a pre-trained `Naive Bayes` or `Logistic Regression` model for sentiment analysis.
* **Data Source:** The Movie Database (TMDb) API for movie details and user reviews.
* **Frontend:** HTML5, CSS3 (Bootstrap), JavaScript (jQuery), AJAX for asynchronous requests.

## 4. Prerequisites

Before running the application, ensure you have the following installed:

* **Python 3.x** (recommended Python 3.8+)
* **pip** (Python package installer)
* **Git** (for cloning the repository)

## 5. Setup and Installation

Follow these steps to get the project up and running on your local machine:

### 5.1. Clone the Repository

```bash
git clone [https://github.com/samminga-akshay/Movie-Recommendation-System-with-Sentiment-Analysis.git](https://github.com/samminga-akshay/Movie-Recommendation-System-with-Sentiment-Analysis.git)
cd Movie-Recommendation-System-with-Sentiment-Analysis

5.2. Create and Activate a Virtual Environment (Recommended)
It's highly recommended to use a virtual environment to manage project dependencies.

python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

5.3. Install Dependencies
Install all the required Python packages using pip:

pip install -r requirements.txt

5.4. Obtain and Set Up TMDb API Key
Go to The Movie Database (TMDb) website and sign up for a free account.
Once logged in, go to your account settings and request an API key (a developer key is usually sufficient).
IMPORTANT:
Open main.py and locate the line TMDB_API_KEY = 'YOUR_TMDB_API_KEY_HERE'. Replace 'YOUR_TMDB_API_KEY_HERE' with your actual TMDb API key.
Open static/js/recommend.js and locate the line const TMDB_API_KEY = 'YOUR_TMDB_API_KEY_HERE';. Replace 'YOUR_TMDB_API_KEY_HERE' with your actual TMDb API key.
(Optional but recommended for larger projects): For production environments, it's best practice to load API keys from environment variables (e.g., using a .env file and python-dotenv). For simplicity in this academic project, direct replacement is used for demonstrative purposes in the appendix.

5.5. Prepare Data and Models
The project requires preprocessed movie data and a trained sentiment analysis model.

Run the Data Fetching and Preprocessing Script: This script (fetch_and_preprocess_data.py) will download initial movie data and clean it, generating main_data.csv. This CSV file forms the basis for content-based recommendations.

python fetch_and_preprocess_data.py
Train the Sentiment Analysis Model: The sentiment analysis model needs to be trained and saved.
If you have a sentiment.ipynb notebook: Open it in Jupyter Notebook/Lab and run all cells. It will save nlp_model.pkl and tranform.pkl in the models/ directory.
If you converted it to a sentiment.py script:

python sentiment.py
(Note: The large reviews.csv dataset, which is used for training the sentiment model, is not included in this repository due to its size. It can be obtained from the IMDb 50K Movie Reviews Dataset on Kaggle. The sentiment script will guide you on where to place it.)
6. Running the Application
After completing the setup steps, you can run the Flask application:

python main.py
The application will typically run on http://127.0.0.1:5000/ or http://localhost:5000/. Open this URL in your web browser.

7. Project Structure
MovieRecommendationSystem/
├── main.py                          # Flask application entry point
├── fetch_and_preprocess_data.py     # Script to fetch & preprocess movie data
├── sentiment.ipynb (or sentiment.py)# Jupyter Notebook/script for sentiment model training
├── requirements.txt                 # Python dependencies
├── README.md                        # This file
├── data/                            # Directory for processed data
│   ├── main_data.csv                # Processed movie data for recommendations
│   └── (reviews.csv - external, for sentiment training)
├── models/                          # Directory for trained ML models
│   ├── nlp_model.pkl                # Trained sentiment analysis model
│   └── tranform.pkl                 # TF-IDF vectorizer for sentiment analysis
├── static/                          # Static assets (CSS, JS, images)
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── recommend.js
└── templates/                       # HTML templates
    ├── home.html
    └── recommend.html

8. Credits and Acknowledgements
The Movie Database (TMDb): All movie data, images, and reviews are sourced from the TMDb API.
NLTK (Natural Language Toolkit): Used for text preprocessing (stopwords, stemming).
scikit-learn: Utilized for TF-IDF vectorization, Cosine Similarity, and machine learning models.
Flask: The web framework used for the backend.
Bootstrap: Frontend styling framework.
jQuery: JavaScript library for DOM manipulation and AJAX.

9. License
This project is open-source and available under the MIT License. See the LICENSE file for more details.