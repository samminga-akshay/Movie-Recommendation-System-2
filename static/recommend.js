// static/recommend.js

// Global variable to store the selected movie data for easy access across functions.
let selectedMovieData = null;

// TMDb API Key (constant for API calls).
// const TMDB_API_KEY = '84e5de76a36aa739e089fbcd4d63a0e9';

// Using jQuery's ready function for broader compatibility with Bootstrap components
// and for easier event delegation.
$(document).ready(function() {
    console.log("jQuery DOM ready. Initializing movie recommendation system.");

    // Only attach autocomplete and initial search button logic if on the home page.
    // We check for the existence of movie-search-input which is only on home.html.
    if ($('#movie-search-input').length) {
        const movieSearchInput = document.getElementById('movie-search-input');
        const searchButton = document.getElementById('search-button');
        const autocompleteList = document.getElementById('autocomplete-list');
        const loader = document.getElementById('loader');
        const failDiv = document.querySelector('.fail');

        // --- Autocomplete Functionality ---
        let currentFocus = -1;

        $(movieSearchInput).on('input', async function() {
            const query = this.value;
            if (!query || query.length < 2) {
                closeAllLists();
                $(searchButton).prop('disabled', true);
                return false;
            }

            $(failDiv).hide();
            if (query.length > 2) {
                $(loader).show();
            }

            try {
                const response = await fetch(`/autocomplete?query=${encodeURIComponent(query)}`);
                const suggestions = await response.json();

                closeAllLists();

                if (suggestions && suggestions.length > 0) {
                    $(autocompleteList).show();
                    suggestions.forEach((movie) => {
                        const item = $('<div></div>')
                            .html(`<strong>${movie.movie_title.substring(0, query.length)}</strong>${movie.movie_title.substring(query.length)}`)
                            .append(`<input type='hidden' value='${movie.movie_title}' data-id='${movie.id}' data-poster='${movie.poster_path}'>`);

                        item.on('click', function() {
                            const movieTitle = $(this).find('input').val();
                            const movieId = $(this).find('input').data('id');
                            const moviePoster = $(this).find('input').data('poster');

                            $(movieSearchInput).val(movieTitle);
                            $(searchButton).prop('disabled', false);
                            selectedMovieData = { title: movieTitle, id: movieId, poster_path: moviePoster };
                            closeAllLists();
                        });
                        $(autocompleteList).append(item);
                    });
                } else {
                    closeAllLists();
                }
            } catch (error) {
                console.error('Error fetching autocomplete suggestions:', error);
                closeAllLists();
            } finally {
                $(loader).hide();
            }
        });

        $(movieSearchInput).on('keydown', function(e) {
            let items = $(autocompleteList).find('div');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                currentFocus++;
                addActive(items);
            } else if (e.key === 'ArrowUp') {
                currentFocus--;
                addActive(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (currentFocus > -1) {
                    if (items[currentFocus]) items[currentFocus].click();
                } else {
                    triggerMovieSearch();
                }
            }
        });

        function addActive(items) {
            if (!items) return false;
            removeActive(items);
            if (currentFocus >= items.length) currentFocus = 0;
            if (currentFocus < 0) currentFocus = (items.length - 1);
            $(items[currentFocus]).addClass('autocomplete-active');
            items[currentFocus].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            $(movieSearchInput).val($(items[currentFocus]).find('input').val());
            selectedMovieData = {
                title: $(items[currentFocus]).find('input').val(),
                id: $(items[currentFocus]).find('input').data('id'),
                poster_path: $(items[currentFocus]).find('input').data('poster')
            };
            $(searchButton).prop('disabled', false);
        }

        function removeActive(items) {
            items.removeClass('autocomplete-active');
        }

        function closeAllLists() {
            $(autocompleteList).empty().hide();
            currentFocus = -1;
        }

        $(document).on('click', function(e) {
            if (!$(e.target).closest('#movie-search-input').length && !$(e.target).closest('#autocomplete-list').length) {
                closeAllLists();
            }
        });

        $(searchButton).prop('disabled', true);

        $(movieSearchInput).on('keyup', function() {
            if (this.value.length > 0) {
                $(searchButton).prop('disabled', false);
            } else {
                $(searchButton).prop('disabled', true);
                selectedMovieData = null;
            }
        });

        $(searchButton).on('click', triggerMovieSearch);

        // --- Core Function to Trigger Movie Search and Display Details (for home.html) ---
        async function triggerMovieSearch() {
            const movieTitle = movieSearchInput.value.trim();
            let movieId = selectedMovieData ? selectedMovieData.id : null; // This is the TMDb ID

            if (!movieTitle) {
                alert('Please enter a movie title.');
                return;
            }

            $(loader).show();
            $(failDiv).hide();

            try {
                if (!movieId) {
                    const searchResponse = await fetch(`/search_movie_by_title?title=${encodeURIComponent(movieTitle)}`);
                    const searchResult = await searchResponse.json();

                    if (searchResult.movie_id) {
                        movieId = searchResult.movie_id;
                    } else {
                        $(failDiv).show().find('h3').text("Sorry! The movie you requested is not in our database. Please check the spelling or try with other movies!");
                        return;
                    }
                }
                
                // Fetch full movie details including credits for director, cast, writers
                const detailsResponse = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}`);
                const movieDetails = await detailsResponse.json();

                if (movieDetails && movieDetails.id) {
                    const creditsResponse = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${TMDB_API_KEY}`);
                    const creditsData = await creditsResponse.json();

                    const director = creditsData.crew.find(member => member.job === 'Director');
                    // Get top 5 cast members with their profile path and person ID
                    const detailedCast = creditsData.cast.slice(0, 10).map(member => ({ // Increased to 10 for more options
                        name: member.name,
                        profile_path: member.profile_path,
                        id: member.id // This is the person_id
                    }));
                    const writers = creditsData.crew.filter(member =>
                        member.department === 'Writing' || member.job === 'Screenplay' || member.job === 'Writer'
                    ).map(member => member.name);

                    const videosResponse = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${TMDB_API_KEY}`);
                    const videosData = await videosResponse.json();
                    const trailer = videosData.results.find(video => video.type === 'Trailer' && video.site === 'YouTube');


                    const dataToSend = {
                        title: movieDetails.title,
                        poster_path: movieDetails.poster_path ? `https://image.tmdb.org/t/p/w500${movieDetails.poster_path}` : 'https://placehold.co/300x450/CCCCCC/333333?text=No+Image',
                        overview: movieDetails.overview,
                        vote_average: movieDetails.vote_average,
                        vote_count: movieDetails.vote_count,
                        genres: movieDetails.genres.map(g => g.name).join(', '),
                        release_date: movieDetails.release_date,
                        runtime: movieDetails.runtime,
                        status: movieDetails.status,
                        director: director ? director.name : 'N/A',
                        cast: detailedCast, // Pass the structured detailedCast array
                        budget: movieDetails.budget,
                        revenue: movieDetails.revenue,
                        original_language: movieDetails.original_language,
                        writers: writers.length > 0 ? Array.from(new Set(writers)).join(', ') : 'N/A',
                        trailer_key: trailer ? trailer.key : null,
                        tmdb_id: movieDetails.id // Pass the TMDb ID for review fetching
                    };

                    const recommendResponse = await fetch('/recommend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dataToSend)
                    });

                    if (recommendResponse.ok) {
                        document.open();
                        document.write(await recommendResponse.text());
                        document.close();
                        // Important: Re-initialize event listeners after document.write()
                        initializeRecommendPageListeners();
                    } else {
                        const errorText = await recommendResponse.text();
                        console.error('Error from /recommend route:', errorText);
                        $(failDiv).show().find('h3').text("An error occurred fetching recommendations from the server. Please try again.");
                    }
                } else {
                    $(failDiv).show().find('h3').text("Could not retrieve full details for this movie from the external database.");
                }
            } catch (error) {
                console.error('Error during movie search or recommendation:', error);
                $(failDiv).show().find('h3').text("Failed to connect to movie databases or an unexpected error occurred. Please check your internet connection and try again later.");
            } finally {
                $(loader).hide();
            }
        }
    }


    // --- Function to initialize event listeners specific to recommend.html ---
    // This function needs to be called after document.write()
    function initializeRecommendPageListeners() {
        console.log("Initializing recommend page listeners...");

        // --- Movie Reviews Button Handler (was IMDb Reviews) ---
        // Use event delegation for the button, as it might be recreated.
        $(document).on('click', '#imdb-reviews-btn', async function() { // Keep ID for now, just change functionality
            const tmdbId = $(this).data('tmdb-id'); // Now getting TMDb ID
            const movieTitle = $('h1').text(); // Get movie title from the h1 tag on the page

            const reviewsModal = $('#reviewsModal');
            const reviewsContent = $('#reviews-content');
            const modalMovieTitle = $('#modal-movie-title');
            const reviewLoader = $('#review-loader');
            const reviewLoaderText = $('#review-loader-text');

            modalMovieTitle.text(movieTitle); // Set modal title based on the currently displayed movie

            if (!tmdbId || tmdbId === 'None' || tmdbId === 'null') { // Check for TMDb ID now
                reviewsContent.html('<p class="text-center" style="color: #f56565;">No TMDb ID found for this movie. Cannot fetch reviews.</p>');
                reviewsModal.modal('show');
                return;
            }

            reviewsContent.empty(); // Clear previous reviews
            reviewLoader.show();
            reviewLoaderText.show().text('Loading reviews from TMDb...');
            reviewsModal.modal('show'); // Show the modal immediately

            try {
                const response = await fetch('/get_movie_reviews', { // Updated route name
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tmdb_id: tmdbId }) // Sending TMDb ID
                });
                const data = await response.json();

                reviewLoader.hide();
                reviewLoaderText.hide();
                reviewsContent.empty(); // Clear loader/text after data is received

                if (data.reviews && data.reviews.length > 0) {
                    data.reviews.forEach(review => {
                        let sentimentClass = '';
                        if (review.sentiment === 'Positive') {
                            sentimentClass = 'sentiment-positive';
                        } else if (review.sentiment === 'Negative') {
                            sentimentClass = 'sentiment-negative';
                        } else {
                            sentimentClass = 'sentiment-unknown';
                        }

                        const reviewHtml = `
                            <div class="review-card">
                                <p class="review-text">"${review.text}"</p>
                                <p><span class="info-label">Sentiment:</span> <span class="${sentimentClass}">${review.sentiment}</span></p>
                            </div>
                        `;
                        reviewsContent.append(reviewHtml);
                    });
                } else {
                    reviewsContent.html('<p class="text-center" style="color: #ccc;">No reviews found on TMDb for this movie.</p>');
                }
            } catch (error) {
                console.error('Error fetching TMDb reviews:', error);
                reviewsContent.html('<p class="text-center" style="color: #f56565;">Failed to load reviews from TMDb. Please try again later.</p>');
            }
        });

        // --- Event Listener for Clicking on Recommended Movies (on recommend.html) ---
        // Also using event delegation for these buttons
        $(document).on('click', '.select-recommended-movie-btn', async function() {
            const card = $(this).closest('.card');
            const movieId = card.data('movie-id'); // This is TMDb ID
            const movieTitle = card.data('movie-title');

            // You likely have a global loader on the home page, but not directly on recommend.html.
            // If you want a loader here, you'd need to add one to recommend.html as well,
            // or dynamically inject a temporary one. For simplicity, we'll just navigate.
            
            // Re-use the main loader if present, or add a temporary one for navigation
            const mainLoader = document.getElementById('loader'); // Check if it exists from home.html
            if (mainLoader) {
                 $(mainLoader).show();
            } else {
                // If no main loader, provide a basic feedback
                $('body').append('<div id="temp-loader" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px; z-index: 9999;">Loading details for "'+ movieTitle +'"...</div>');
            }


            try {
                // Fetch full movie details including credits for director, cast, writers
                const detailsResponse = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}`);
                const movieDetails = await detailsResponse.json();

                if (movieDetails && movieDetails.id) {
                    const creditsResponse = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${TMDB_API_KEY}`);
                    const creditsData = await creditsResponse.json();

                    const director = creditsData.crew.find(member => member.job === 'Director');
                    const detailedCast = creditsData.cast.slice(0, 10).map(member => ({ // Increased to 10
                        name: member.name,
                        profile_path: member.profile_path,
                        id: member.id
                    }));
                    const writers = creditsData.crew.filter(member =>
                        member.department === 'Writing' || member.job === 'Screenplay' || member.job === 'Writer'
                    ).map(member => member.name);

                    const videosResponse = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${TMDB_API_KEY}`);
                    const videosData = await videosResponse.json();
                    const trailer = videosData.results.find(video => video.type === 'Trailer' && video.site === 'YouTube');

                    const dataToSend = {
                        title: movieDetails.title,
                        poster_path: movieDetails.poster_path ? `https://image.tmdb.org/t/p/w500${movieDetails.poster_path}` : 'https://placehold.co/300x450/CCCCCC/333333?text=No+Image',
                        overview: movieDetails.overview,
                        vote_average: movieDetails.vote_average,
                        vote_count: movieDetails.vote_count,
                        genres: movieDetails.genres.map(g => g.name).join(', '),
                        release_date: movieDetails.release_date,
                        runtime: movieDetails.runtime,
                        status: movieDetails.status,
                        director: director ? director.name : 'N/A',
                        cast: detailedCast, // Send structured cast data
                        budget: movieDetails.budget,
                        revenue: movieDetails.revenue,
                        original_language: movieDetails.original_language,
                        writers: writers.length > 0 ? Array.from(new Set(writers)).join(', ') : 'N/A',
                        trailer_key: trailer ? trailer.key : null,
                        tmdb_id: movieDetails.id // Pass the TMDb ID for review fetching
                    };

                    const recommendResponse = await fetch('/recommend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dataToSend)
                    });

                    if (recommendResponse.ok) {
                        document.open();
                        document.write(await recommendResponse.text());
                        document.close();
                        initializeRecommendPageListeners(); // Re-initialize for the new page content
                    } else {
                        const errorText = await recommendResponse.text();
                        console.error('Error from /recommend route (recommended movie click):', errorText);
                        alert("An error occurred loading recommended movie details. Please try again.");
                    }
                } else {
                    alert("Could not retrieve details for the selected movie.");
                }
            } catch (error) {
                console.error('Error clicking recommended movie:', error);
                alert("Failed to load recommended movie details. Please check your internet connection.");
            } finally {
                if (mainLoader) {
                    $(mainLoader).hide();
                } else {
                    $('#temp-loader').remove(); // Remove temporary loader
                }
            }
        });

        // --- Cast Biography Modal Handler ---
        $(document).on('click', '.cast-member-card', async function() {
            const personId = $(this).data('person-id');
            const personName = $(this).data('person-name');

            const bioModal = $('#castBioModal');
            const bioContent = $('#bio-content');
            const bioName = $('#cast-bio-name');
            const bioLoader = $('#bio-loader');
            const bioLoaderText = $('#bio-loader-text');

            bioName.text(personName);
            bioContent.empty(); // Clear previous content
            bioLoader.show();
            bioLoaderText.show().text('Loading biography...');
            bioModal.modal('show');

            try {
                const personDetailsUrl = `https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}`;
                const response = await fetch(personDetailsUrl);
                const personData = await response.json();

                bioLoader.hide();
                bioLoaderText.hide();
                bioContent.empty(); // Clear loader/text after data is received

                if (personData && personData.id) {
                    let biography = personData.biography || 'Biography not available.';
                    // Truncate long biographies, offer "read more" if needed
                    if (biography.length > 800) { // Arbitrary length, adjust as desired
                        const truncatedBio = biography.substring(0, 800);
                        biography = `<span class="truncated-bio">${truncatedBio} ...</span> <a href="#" class="read-more-link" data-full-bio="${encodeURIComponent(biography)}">Read More</a>`;
                    }

                    let birthday = personData.birthday ? new Date(personData.birthday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
                    let deathday = personData.deathday ? new Date(personData.deathday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
                    
                    let age = 'N/A';
                    if (personData.birthday) {
                        const birthDate = new Date(personData.birthday);
                        const today = new Date();
                        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
                        const m = today.getMonth() - birthDate.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                            calculatedAge--;
                        }
                        if (personData.deathday) {
                            const deathDate = new Date(personData.deathday);
                            calculatedAge = deathDate.getFullYear() - birthDate.getFullYear();
                            const dm = deathDate.getMonth() - birthDate.getMonth();
                            if (dm < 0 || (dm === 0 && deathDate.getDate() < birthDate.getDate())) {
                                calculatedAge--;
                            }
                            age = `${calculatedAge} (Deceased on ${deathday})`;
                        } else {
                            age = calculatedAge;
                        }
                    }

                    const knownForDepartment = personData.known_for_department || 'N/A';
                    const placeOfBirth = personData.place_of_birth || 'N/A';
                    
                    const bioHtml = `
                        <p><span class="info-label">Known For:</span> <span class="info-value">${knownForDepartment}</span></p>
                        <p><span class="info-label">Born:</span> <span class="info-value">${birthday}</span> (Age: ${age})</p>
                        ${personData.deathday ? `<p><span class="info-label">Died:</span> <span class="info-value">${deathday}</span></p>` : ''}
                        <p><span class="info-label">Place of Birth:</span> <span class="info-value">${placeOfBirth}</span></p>
                        <hr style="border-top: 1px solid #4a5568;">
                        <h5 style="color: #e50914;">Biography</h5>
                        <p class="biography-text" style="color: #eee;">${biography}</p>
                    `;
                    bioContent.append(bioHtml);

                    // Add click listener for "Read More" if present
                    bioContent.on('click', '.read-more-link', function(e) {
                        e.preventDefault();
                        const fullBio = decodeURIComponent($(this).data('full-bio'));
                        $(this).siblings('.truncated-bio').text(fullBio);
                        $(this).remove(); // Remove the "Read More" link
                    });

                } else {
                    bioContent.html('<p class="text-center" style="color: #f56565;">Could not retrieve biography for this person.</p>');
                }
            } catch (error) {
                console.error('Error fetching person details:', error);
                bioContent.html('<p class="text-center" style="color: #f56565;">Failed to load biography. Please try again later.</p>');
            }
        });
    }

    // Call initializeRecommendPageListeners once when the initial document is loaded
    // (in case the user directly navigates to recommend.html, or it's the first render).
    // This handles the initial setup if already on recommend.html.
    // We check for elements unique to recommend.html.
    if ($('#imdb-reviews-btn').length || $('.select-recommended-movie-btn').length || $('.cast-member-card').length) {
        initializeRecommendPageListeners();
    }
});