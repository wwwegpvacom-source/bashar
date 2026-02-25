function initUI() {
    // 1. Path Management (Simplified with root-relative paths)
    const paths = (window.siteConfig && window.siteConfig.pathConfig) ? window.siteConfig.pathConfig : {
        product: 'product',
        category: 'category',
        blog: 'blog'
    };

    const mobileMenuBtn = document.getElementById('mobile-menu-btn'),
          mobileMenu = document.getElementById('mobile-menu'),
          mobileBackdrop = document.getElementById('mobile-menu-backdrop'),
          menuOpenIcon = document.getElementById('menu-open-icon'),
          menuCloseIcon = document.getElementById('menu-close-icon'),
          searchInput = document.getElementById('search-services'),
          categorySelect = document.getElementById('category-select'),
          productGrid = document.getElementById('product-grid');

    // 2. Filter Products (Optimized)
    function filterProducts() {
        if (!productGrid) return;
        const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
        const selectedCategory = (categorySelect ? categorySelect.value : 'All Categories');
        const cards = productGrid.querySelectorAll('.card-glow');
        
        // Use document fragment for better performance if we were adding/removing, 
        // but here we just toggle display. Still, we can minimize reflows.
        productGrid.style.display = 'none'; 
        
        let visibleCount = 0;
        cards.forEach(card => {
            const title = card.querySelector('h3, .font-bold.text-slate-100')?.textContent.toLowerCase() || '';
            const category = card.querySelector('.text-cyan-400')?.textContent || '';
            const matchesSearch = title.includes(searchTerm);
            const matchesCategory = selectedCategory === 'All Categories' || category === selectedCategory;
            
            if (matchesSearch && matchesCategory) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        productGrid.style.display = '';

        let noResults = document.getElementById('no-results-message');
        if (visibleCount === 0) {
            if (!noResults) {
                noResults = document.createElement('div');
                noResults.id = 'no-results-message';
                noResults.className = 'col-span-full py-20 text-center';
                noResults.innerHTML = `
                    <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
                        <i data-lucide="search-x" class="w-8 h-8 text-slate-500"></i>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">No results found</h3>
                    <p class="text-slate-400">Try adjusting your search or category filter</p>
                `;
                productGrid.appendChild(noResults);
                if (window.lucide) window.lucide.createIcons();
            }
        } else if (noResults) {
            noResults.remove();
        }
    }

    // Debounce search for better performance
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(filterProducts, 150);
        }, { passive: true });
    }
    if (categorySelect) categorySelect.addEventListener('change', filterProducts, { passive: true });

    // 3. Popup & Mobile Menu Logic (Streamlined)
    function closeMobileMenu() {
        if (!mobileMenu) return;
        mobileMenu.classList.add('hidden');
        mobileMenu.classList.remove('flex');
        if (mobileBackdrop) mobileBackdrop.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        if (menuOpenIcon) menuOpenIcon.classList.remove('hidden');
        if (menuCloseIcon) menuCloseIcon.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
    window.closeMobileMenu = closeMobileMenu;

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            if (mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.remove('hidden');
                mobileMenu.classList.add('flex');
                if (mobileBackdrop) {
                    mobileBackdrop.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
                    mobileBackdrop.classList.add('opacity-100');
                }
                if (menuOpenIcon) menuOpenIcon.classList.add('hidden');
                if (menuCloseIcon) menuCloseIcon.classList.remove('hidden');
                document.body.classList.add('overflow-hidden');
            } else closeMobileMenu();
        }, { passive: true });
    }

    if (mobileBackdrop) mobileBackdrop.addEventListener('click', closeMobileMenu, { passive: true });

    document.querySelectorAll('.mobile-cat-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const cat = toggle.getAttribute('data-cat');
            const items = document.getElementById(`mobile-items-${cat}`);
            const icon = toggle.querySelector('i');
            if (items) {
                const isHidden = items.classList.toggle('hidden');
                if (icon) icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        }, { passive: true });
    });

    window.openPopup = function() {
        const popup = document.getElementById('contact-popup');
        const popupBackdrop = document.getElementById('popup-backdrop');
        const popupPanel = document.getElementById('popup-panel');
        if (!popup) return;
        
        popup.classList.remove('hidden');
        setTimeout(() => {
            if (popupBackdrop) popupBackdrop.classList.remove('opacity-0', 'pointer-events-none');
            if (popupPanel) popupPanel.classList.remove('opacity-0', 'scale-95');
        }, 10);
        document.body.classList.add('overflow-hidden');
    };

    window.closePopup = function() {
        const popup = document.getElementById('contact-popup');
        const popupBackdrop = document.getElementById('popup-backdrop');
        const popupPanel = document.getElementById('popup-panel');
        if (!popup) return;
        
        if (popupBackdrop) popupBackdrop.classList.add('opacity-0', 'pointer-events-none');
        if (popupPanel) popupPanel.classList.add('opacity-0', 'scale-95');
        
        setTimeout(() => {
            popup.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }, 300);
    };

    // 4. Tab Switching Logic (Robust & Independent)
    function handleTabSwitching() {
        // Use event delegation on the document for maximum robustness
        document.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('[id^="tab-btn-"]');
            if (!tabBtn) return;

            const tabId = tabBtn.id.replace('tab-btn-', '');
            const tabContainer = tabBtn.closest('.mt-12'); // The tab wrapper
            if (!tabContainer) return;

            const allBtns = tabContainer.querySelectorAll('[id^="tab-btn-"]');
            const allTabs = tabContainer.querySelectorAll('[id^="tab-"]');

            const activeClass = "px-4 md:px-8 py-3 bg-[#1E293B]/50 text-cyan-400 font-bold rounded-t-lg border-t border-x border-white/5 text-sm relative top-[1px] transition-all";
            const inactiveClass = "px-4 md:px-8 py-3 text-slate-400 hover:text-slate-200 font-medium text-sm transition-colors";

            // Update Tabs
            allTabs.forEach(tab => {
                // Ensure we are only targeting the actual tab content divs, not the buttons
                if (tab.id === `tab-${tabId}`) {
                    tab.classList.remove('hidden');
                } else if (tab.id.startsWith('tab-') && !tab.id.includes('btn')) {
                    tab.classList.add('hidden');
                }
            });

            // Update Buttons
            allBtns.forEach(btn => {
                if (btn.id === `tab-btn-${tabId}`) btn.className = activeClass;
                else btn.className = inactiveClass;
            });

            if (window.lucide) window.lucide.createIcons();
        });
    }
    handleTabSwitching();

    // 5. Dynamic Hydration Logic (Ensures site_data.js updates reflect immediately)
    function hydratePage() {
        const urlParams = new URLSearchParams(window.location.search);
        const dynamicProductPath = urlParams.get('p');
        const dynamicCategoryPath = urlParams.get('c');
        const path = dynamicProductPath || dynamicCategoryPath || window.location.pathname;
        
        const siteConfig = window.siteConfig || {};
        const paths = siteConfig.pathConfig || { product: 'product', category: 'category', blog: 'blog' };
        
        // If we came from 404 redirect, we might need to show a special UI or just hydrate the home
        if (dynamicProductPath || dynamicCategoryPath) {
            console.log("Dynamic route detected:", path);
            // In a real SPA we would swap templates here. 
            // For now, let's at least show the correct info if possible.
        }

        // Helper: Find item by slug in a list
        const findBySlug = (list, slug) => list ? list.find(item => item.slug === slug) : null;
        const getOverlayTitle = (product) => {
            const displayTitle = product && typeof product.display_title === 'string' ? product.display_title.trim() : '';
            if (displayTitle) return displayTitle;
            const title = product && typeof product.title === 'string' ? product.title : '';
            return title.replace(/^Buy\s+/i, '');
        };

        // 5a. Product Page Hydration
        if (path.includes(`/${paths.product}/`)) {
            const slugPart = path.split(`/${paths.product}/`)[1];
            if (!slugPart) return;
            const slug = slugPart.replace(/\/+$/, '');
            const product = findBySlug(window.products, slug);
            if (product) {
                console.log("Hydrating Product:", product.title);
                const titleEl = document.getElementById('detail-title') || document.querySelector('h1');
                const priceEl = document.getElementById('detail-price');
                const descEl = document.getElementById('detail-desc') || document.getElementById('long-desc');
                
                if (titleEl) titleEl.textContent = product.title;
                if (priceEl) priceEl.textContent = `$${product.min_price.toFixed(2)} - $${product.max_price.toFixed(2)}`;
                
                const shortDescEl = document.getElementById('detail-desc');
                if (shortDescEl) shortDescEl.textContent = product.short_description || product.description;

                // Update reviews count if elements exist
                const reviewCountBadge = document.getElementById('review-count-badge');
                if (reviewCountBadge && window.reviewsData) {
                    const count = window.reviewsData.filter(r => r.productId === product.id).length;
                    reviewCountBadge.textContent = count;
                }
            }
        }
        
        // 5b. Category Page Hydration
        else if (path.includes(`/${paths.category}/`)) {
            const slugPart = path.split(`/${paths.category}/`)[1];
            if (!slugPart) return;
            const slug = slugPart.replace(/\/+$/, '');
            const category = findBySlug(window.categories, slug);
            if (category) {
                console.log("Hydrating Category:", category.name);
                const titleEl = document.querySelector('h1');
                if (titleEl) titleEl.textContent = category.name;
            }
        }

        // 5c. Global Elements (Header/Footer Links)
        // We can update the navigation links to use the latest slugs from paths
        document.querySelectorAll('a[data-type]').forEach(link => {
            const type = link.getAttribute('data-type');
            const slug = link.getAttribute('data-slug');
            if (type && paths[type]) {
                const newUrl = (type === 'home') ? '/' : `/${paths[type]}/${slug || ''}/`.replace(/\/+/g, '/');
                link.href = newUrl;
            }
        });

        // 5d. Product Grid Updates (for Home/Category pages)
        if (document.getElementById('product-grid') && window.products) {
            const cards = document.querySelectorAll('.card-glow');
            cards.forEach(card => {
                const cardLink = card.querySelector('a');
                if (!cardLink) return;
                
                // Extract slug from card link
                const href = cardLink.getAttribute('href');
                const slugPart = href.split(`/${paths.product}/`)[1];
                if (!slugPart) return;
                const slug = slugPart.replace(/\/+$/, '');
                
                const product = findBySlug(window.products, slug);
                if (product) {
                    // Check Active Status
                    if (product.active === false) {
                        card.style.display = 'none';
                        return;
                    }

                    // Update Title
                    const titleEl = card.querySelector('h3, .font-bold.text-slate-100');
                    if (titleEl) titleEl.textContent = getOverlayTitle(product);
                    
                    // Update Price
                    const priceEl = card.querySelector('.text-xl.font-black.text-white');
                    if (priceEl) priceEl.textContent = `$${product.min_price.toFixed(2)}`;
                }
            });
        }
    }
    hydratePage();

    // 6. Hydration Logic (Lucide Icons)
    function initIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        } else {
            // Retry if lucide is not yet loaded
            setTimeout(initIcons, 100);
        }
    }
    initIcons();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
else initUI();
