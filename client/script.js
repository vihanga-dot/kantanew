import { supabase } from "./src/lib/supabase.ts";

// Product data is loaded from Supabase. The local JSON remains only as a
// development fallback when environment variables are not configured.
let products = [];

async function loadProducts() {
    try {
        const { data: catalog, error } = await supabase
            .from('snacks')
            .select('*')
            .eq('is_published', true)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        products = (catalog || []).map(product => ({
            ...product,
            image: product.image_url,
            price: Number(product.price),
        }));
    } catch (error) {
        console.warn('Using static catalog fallback:', error);
        try {
            const response = await fetch('/products.json');
            products = await response.json();
        } catch (fallbackError) {
            console.error('Error loading products:', fallbackError);
            products = [];
        }
    }
}

async function loadSiteSettings() {
    try {
        const { data: settings, error } = await supabase
            .from('site_settings')
            .select('*')
            .eq('id', 1)
            .single();
        if (error) throw error;
        if (!settings) return;
        const announcement = document.querySelector('.announcement');
        if (announcement && settings.announcement) announcement.textContent = settings.announcement;
        const heroSlides = document.querySelectorAll('.hero-slide');
        if (heroSlides[0]) {
            const title = heroSlides[0].querySelector('h1');
            const subtitle = heroSlides[0].querySelector('p');
            if (title && settings.hero_title) title.textContent = settings.hero_title;
            if (subtitle && settings.hero_subtitle) subtitle.textContent = settings.hero_subtitle;
        }
        if (heroSlides[1]) {
            const title = heroSlides[1].querySelector('h1');
            const subtitle = heroSlides[1].querySelector('p');
            if (title && settings.about_title) title.textContent = settings.about_title;
            if (subtitle && settings.about_body) subtitle.textContent = settings.about_body;
        }
    } catch (error) {
        console.warn('Using static site copy fallback:', error);
    }
}

// Hero Slider
let currentSlide = 0;

function goToSlide(index) {
    const slider = document.getElementById('heroSlider');
    if (!slider) return;

    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.slider-dot');
    currentSlide = index;

    // Update active class on slides
    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === currentSlide);
    });

    // Update active class on dots
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });

    // Also update transform for the slider to maintain the sliding effect
    slider.style.transform = `translateX(-${currentSlide * 100}%)`;
}

function nextSlide() {
    const slider = document.getElementById('heroSlider');
    if (!slider) return;

    const totalSlides = slider.children.length;
    currentSlide = (currentSlide + 1) % totalSlides;
    goToSlide(currentSlide);
}

// Auto-advance slides every 5 seconds
if (document.getElementById('heroSlider')) {
    setInterval(nextSlide, 5000);
}

// Initialize the first slide as active by default
function initHeroSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length > 0) {
        // Remove active class from all slides
        slides.forEach(slide => slide.classList.remove('active'));
        // Add active class to the first slide
        slides[0].classList.add('active');
    }

    const dots = document.querySelectorAll('.slider-dot');
    if (dots.length > 0) {
        // Remove active class from all dots
        dots.forEach(dot => dot.classList.remove('active'));
        // Add active class to the first dot
        dots[0].classList.add('active');
    }
}

// Mobile Menu Toggle
function toggleMenu() {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.querySelector('.menu-toggle');
    navLinks.classList.toggle('active');
    menuToggle.classList.toggle('active');
}

// Add scroll effect to navbar
window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Close mobile menu when a link is clicked
document.addEventListener('DOMContentLoaded', function() {
    // Initialize hero slider
    initHeroSlider();

    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    navLinks.classList.remove('active');
                    document.querySelector('.menu-toggle').classList.remove('active');
                }
            });
        });
    }

    // Initialize products page if on products page
    if (document.getElementById('productGrid')) {
        // Populate all dropdowns with all available options
        updateProductDropdown(); // This populates products dropdown


        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const priceParam = urlParams.get('price');

        // If price parameter exists, select the corresponding dropdown option
        if (priceParam) {
            const priceSelect = document.getElementById('priceSelect');
            if (priceSelect) {
                priceSelect.value = priceParam;
                // Trigger the update function to populate dependent dropdowns
                setTimeout(() => {
                    updateProductDropdown();
                    updateColorDropdown();
                    // Also trigger the actual filtering
                    filterProductsByDropdown();
                }, 100);
            }
        } else {
            // If no price parameter, just initialize the products
            displayAllProducts();
        }
    }

    // Initialize price carousel if on home page
    if (document.getElementById('priceCarousel')) {
        initPriceSlides();
        // Set up initial state
        updatePriceIndicators(0);

        // Start auto slide on home page
        startAutoSlide();
    }

    // Animate elements when they come into view
    animateOnScroll();

    // Add animation class to footer
    const footer = document.querySelector('.footer');
    if (footer) {
        // Add animate class after a short delay to ensure it's visible
        setTimeout(() => {
            footer.classList.add('animate');
        }, 500);
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

// Filter Products
function filterProducts() {
    const productGrid = document.getElementById('productGrid');
    if (!productGrid) return;

    // Get selected filters
    const selectedPrices = Array.from(document.querySelectorAll('input[id^="price"]:checked')).map(cb => parseInt(cb.value));
    const selectedColors = Array.from(document.querySelectorAll('input[id^="color"]:checked')).map(cb => cb.value);

    // Filter products
    let filteredProducts = products;

    if (selectedPrices.length > 0) {
        filteredProducts = filteredProducts.filter(p => selectedPrices.includes(p.price));
    }

    if (selectedColors.length > 0) {
        filteredProducts = filteredProducts.filter(p => selectedColors.includes(p.color));
    }

    // Display filtered products
    displayProducts(filteredProducts);
}

function displayProducts(productGroups) {
    const productGrid = document.getElementById('productGrid');
    if (!productGrid) return;

    if (productGroups.length === 0) {
        productGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <h3 style="color: var(--primary-red); margin-bottom: 1rem;">No products found</h3>
                <p>Try adjusting your filters to see more products.</p>
            </div>
        `;
        return;
    }

    productGrid.innerHTML = productGroups.map(group => {
        const product = group[0]; // Use the first product for card display
        return `
            <div class="product-card" onclick='showProductDetail(${JSON.stringify(group)})'>
                <div class="product-image">
                    ${product.image ?
                        `<img src="${product.image}" alt="${product.name}" class="product-img" />` :
                        `<div class="fallback-text">${product.icon || ' biscuit '}</div>`}
                </div>
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p class="product-price">Rs. ${product.price}</p>
                    <p>${product.description.substring(0, 60)}...</p>
                </div>
            </div>
        `;
    }).join('');

    // Reveal images after they decode; cached images are handled immediately too.
    setTimeout(() => {
        document.querySelectorAll('.product-img').forEach(img => {
            const markImageLoaded = () => img.classList.add('is-loaded');
            img.addEventListener('error', function() {
                if (this.parentElement && this.parentElement.classList) {
                    this.parentElement.classList.add('with-fallback');
                }
                this.classList.add('is-loaded');
            });

            img.addEventListener('load', function() {
                markImageLoaded();
                if (this.parentElement && this.parentElement.classList) {
                    this.parentElement.classList.remove('with-fallback');
                }
            });
            if (img.complete) markImageLoaded();
        });
    }, 100);
}

function groupProducts(productsToGroup) {
    if (!productsToGroup) return [];
    const grouped = {};
    productsToGroup.forEach(product => {
        const key = `${product.name}-${product.price}`;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(product);
    });
    return Object.values(grouped);
}

// Dropdown-based filtering functions
function updateProductDropdown() {
    const priceSelect = document.getElementById('priceSelect');
    const productSelect = document.getElementById('productSelect');
    const selectedPrice = priceSelect.value;

    // Reset child dropdowns
    productSelect.value = '';

    // Get all unique product names
    let allProducts = products;
    if (selectedPrice) {
        allProducts = products.filter(p => p.price == selectedPrice);
    }

    productSelect.innerHTML = '<option value="">All Products</option>';

    // Create unique product names list
    const productNames = [...new Set(allProducts.map(p => p.name))];

    // Populate product dropdown
    productNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        productSelect.appendChild(option);
    });
}



function filterProductsByDropdown() {
    const priceSelect = document.getElementById('priceSelect');
    const productSelect = document.getElementById('productSelect');

    const selectedPrice = priceSelect.value;
    const selectedProduct = productSelect.value;

    let filteredProducts = [...products];

    if (selectedPrice) {
        filteredProducts = filteredProducts.filter(p => p.price == selectedPrice);
    }

    if (selectedProduct) {
        filteredProducts = filteredProducts.filter(p => p.name === selectedProduct);
    }

    displayProducts(groupProducts(filteredProducts));
}

function clearDropdownFilters() {
    const priceSelect = document.getElementById('priceSelect');
    const productSelect = document.getElementById('productSelect');

    priceSelect.value = '';
    productSelect.value = '';

    // Repopulate all dropdowns with all options
    updateProductDropdown(); // This will clear the color dropdown too
    displayAllProducts();
}

function displayAllProducts() {
    displayProducts(groupProducts(products));
}

function clearFilters() {
    document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(cb => cb.checked = false);
    filterProducts();
}

function getCssColor(colorName) {
    const colorMap = {
        "budget": "grey",
        "m1": "lightcoral",
        "m2": "coral",
        "m3": "tomato",
        "g1": "lightgreen",
        "g2": "limegreen",
        "g3": "green",
    };
    return colorMap[colorName.toLowerCase()] || colorName.toLowerCase();
}

// Product Modal
function showProductDetail(productGroup) {
    const modal = document.getElementById('productModal');
    if (!modal) return;

    // If product is a string (from onclick), parse it safely
    if (typeof productGroup === 'string') {
        try {
            productGroup = JSON.parse(productGroup);
        } catch (e) {
            console.error('Invalid product data:', e);
            return;
        }
    }

    const product = productGroup[0];

    if (product.image) {
        document.getElementById('modalIcon').innerHTML = `<img src="${product.image}" alt="${product.name}" class="modal-product-img" /><div class="fallback-text modal-fallback" style="display:none;">${product.icon || ' biscuit '}</div>`;
    } else {
        document.getElementById('modalIcon').textContent = product.icon || ' biscuit ';
    }
    document.getElementById('modalTitle').textContent = product.name;
    document.getElementById('modalPrice').textContent = `Rs. ${product.price}`;
    document.getElementById('modalWeight').textContent = product.weight;
    document.getElementById('modalColor').textContent = product.color.charAt(0).toUpperCase() + product.color.slice(1);
    document.getElementById('modalDescription').textContent = product.description;

    const modalColors = document.getElementById('modalColors');
    modalColors.innerHTML = '';
    if (productGroup.length > 1) {
        productGroup.forEach(p => {
            const colorCircle = document.createElement('span');
            colorCircle.className = 'color-circle';
            colorCircle.style.backgroundColor = getCssColor(p.color);
            colorCircle.dataset.color = p.color;
            colorCircle.title = p.color;
            colorCircle.onclick = () => {
                document.getElementById('modalIcon').innerHTML = `<img src="${p.image}" alt="${p.name}" class="modal-product-img" />`;
                document.getElementById('modalColor').textContent = p.color.charAt(0).toUpperCase() + p.color.slice(1);
            };
            modalColors.appendChild(colorCircle);
        });
    }


    modal.style.display = 'block';

    // Add animation to modal content
    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) {
            modalContent.classList.add('show');
        }

        // Add error handling for modal image
        const modalImg = document.querySelector('.modal-product-img');
        if (modalImg) {
            modalImg.addEventListener('error', function() {
                if (this.parentElement && this.nextElementSibling) {
                    this.style.display = 'none';
                    this.nextElementSibling.style.display = 'flex';
                }
            });

            modalImg.addEventListener('load', function() {
                if (this.parentElement && this.nextElementSibling) {
                    this.style.display = 'block';
                    this.nextElementSibling.style.display = 'none';
                }
            });
        }
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('productModal');
    const modalContent = document.querySelector('.modal-content');

    if (modalContent) {
        modalContent.classList.remove('show');

        // Hide modal after animation completes
        setTimeout(() => {
            if (modal) {
                modal.style.display = 'none';
            }
        }, 300);
    } else if (modal) {
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('productModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Price Cards Carousel functionality - Single card display
let currentPriceSlide = 0;
let priceSlides = [];
let autoSlideInterval;

function initPriceSlides() {
    priceSlides = document.querySelectorAll('.price-card-slide');
    // Hide all slides initially except the first one
    priceSlides.forEach((slide, index) => {
        if (index === 0) {
            slide.classList.add('active');
        } else {
            slide.classList.remove('active');
        }
    });
}

// Ensure carousel buttons work correctly
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners to carousel buttons if they exist
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', function(e) {
            e.preventDefault();
            prevPriceSlide();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
            e.preventDefault();
            nextPriceSlide();
        });
    }
});

function showPriceSlide(index) {
    if (!priceSlides.length) return;

    // Hide all slides
    priceSlides.forEach(slide => slide.classList.remove('active'));

    // Show the selected slide
    if (priceSlides[index]) {
        priceSlides[index].classList.add('active');
    }

    // Update current slide index
    currentPriceSlide = index;
}

function nextPriceSlide() {
    if (!priceSlides.length) return;

    currentPriceSlide = (currentPriceSlide + 1) % priceSlides.length;
    showPriceSlide(currentPriceSlide);
}

function prevPriceSlide() {
    if (!priceSlides.length) return;

    currentPriceSlide = (currentPriceSlide - 1 + priceSlides.length) % priceSlides.length;
    showPriceSlide(currentPriceSlide);
}

function goToPriceSlide(index) {
    if (!priceSlides.length) return;

    showPriceSlide(index);
}

function updatePriceIndicators(index) {
    // Function no longer needed since indicators are removed
}

// Auto-advance price carousel every few seconds (only if on home page)
function startAutoSlide() {
    if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
    }

    autoSlideInterval = setInterval(() => {
        nextPriceSlide();
    }, 5000); // Show each slide for 5 seconds
}

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    await Promise.all([loadProducts(), loadSiteSettings()]);

    // Add scroll animation to navbar
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        }
        else {
            navbar.classList.remove('scrolled');
        }
    });

    Object.assign(window, {
        toggleMenu,
        goToSlide,
        prevPriceSlide,
        nextPriceSlide,
        clearDropdownFilters,
        closeModal,
        showProductDetail,
    });

    // Initialize products page if on products page
    if (document.getElementById('productGrid')) {
        // Populate all dropdowns with all available options
        updateProductDropdown(); // This populates products dropdown

        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const priceParam = urlParams.get('price');

        // If price parameter exists, select the corresponding dropdown option
        if (priceParam) {
            const priceSelect = document.getElementById('priceSelect');
            if (priceSelect) {
                priceSelect.value = priceParam;
                // Trigger the update function to populate dependent dropdowns
                setTimeout(() => {
                    updateProductDropdown();
                    // Also trigger the actual filtering
                    filterProductsByDropdown();
                }, 100);
            }
        } else {
            // If no price parameter, just initialize the products
            displayAllProducts();
        }
    }

    // Initialize price carousel if on home page
    if (document.getElementById('priceCarousel')) {
        initPriceSlides();
        // Set up initial state
        updatePriceIndicators(0);

        // Start auto slide on home page
        startAutoSlide();
    }

    // Animate elements when they come into view
    animateOnScroll();

    // Add animation class to footer
    const footer = document.querySelector('.footer');
    if (footer) {
        // Add animate class after a short delay to ensure it's visible
        setTimeout(() => {
            footer.classList.add('animate');
        }, 500);
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

// Function to animate elements when they come into view
function animateOnScroll() {
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');

                // Add staggered animation for product cards
                if (entry.target.classList.contains('product-card')) {
                    setTimeout(() => {
                        entry.target.style.transitionDelay = '0.1s';
                    }, 100 * Array.from(document.querySelectorAll('.product-card')).indexOf(entry.target));
                }
            }
        });
    }, observerOptions);

    // Observe elements that should animate
    document.querySelectorAll('.product-card, .section-title, .btn-primary, .btn-secondary, .footer').forEach(el => {
        observer.observe(el);
    });
}
