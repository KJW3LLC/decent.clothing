// Search and Filter Functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const guideCards = document.querySelectorAll('.guide-card');
    const noResults = document.getElementById('no-results');

    let currentArticleType = 'all';
    let currentSearchTerm = '';

    const heroStyleWord = document.querySelector('.hero-style-word');
    const heroStyleClasses = [
        'hero-style-dm-serif',
        'hero-style-cormorant',
        'hero-style-playfair',
        'hero-style-bodoni',
        'hero-style-baskerville'
    ];
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let heroStyleIndex = 0;

    if (heroStyleWord && !prefersReducedMotion) {
        window.setInterval(() => {
            heroStyleWord.classList.add('is-changing');

            window.setTimeout(() => {
                heroStyleWord.classList.remove(heroStyleClasses[heroStyleIndex]);
                heroStyleIndex = (heroStyleIndex + 1) % heroStyleClasses.length;
                heroStyleWord.classList.add(heroStyleClasses[heroStyleIndex]);
            }, 315);

            window.setTimeout(() => {
                heroStyleWord.classList.remove('is-changing');
            }, 650);
        }, 3200);
    }

    // Filter by article type
    if (filterButtons) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Update active state
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                // Get selected article type
                currentArticleType = this.dataset.articleType;

                // Apply filters
                applyFilters();
            });
        });
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            currentSearchTerm = this.value.toLowerCase();
            applyFilters();
        });
    }

    // Apply all active filters
    function applyFilters() {
        let visibleCount = 0;

        guideCards.forEach(card => {
            const articleType = card.dataset.articleType;
            const title = card.dataset.title;
            const description = card.dataset.description;
            const tags = card.dataset.tags.toLowerCase();

            // Check article type filter
            const matchesArticleType = currentArticleType === 'all' || articleType === currentArticleType;

            // Check search filter
            const matchesSearch = currentSearchTerm === '' ||
                                title.includes(currentSearchTerm) ||
                                description.includes(currentSearchTerm) ||
                                tags.includes(currentSearchTerm);

            // Show or hide card
            if (matchesArticleType && matchesSearch) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        // Show/hide no results message
        if (noResults) {
            noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});
