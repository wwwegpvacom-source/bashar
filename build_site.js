const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- 1. Load Data ---
console.log("Reading site_data.js...");
const dataJsContent = fs.readFileSync('site_data.js', 'utf8');

// Append assignment to ensure we capture const/let variables which are not automatically attached to sandbox
const scriptContent = dataJsContent + `
;
this.siteConfig = siteConfig;
this.categories = categories;
this.reviewsData = reviewsData;
this.products = products;
this.blogs = blogs || [];
try { this.gradients = gradients; } catch(e) {}
`;

// Use VM to execute the data file safely to extract variables
const sandbox = { 
    console: console, // Allow logging if any
    document: {}, // Mock document if needed to prevent reference errors during parsing
    window: {},
    alert: () => {},
    confirm: () => false
};
vm.createContext(sandbox);

try {
    vm.runInContext(scriptContent, sandbox);
} catch (e) {
    console.error("Error parsing site_data.js:", e);
    process.exit(1);
}

const siteConfig = sandbox.siteConfig;
const categories = sandbox.categories;
const reviewsData = sandbox.reviewsData;
const productsRaw = sandbox.products;
const products = productsRaw ? productsRaw.filter(p => p.active !== false) : [];
const blogs = sandbox.blogs || [];
const gradients = sandbox.gradients || {}; // gradients might be missing or defined elsewhere

// --- URL Configuration ---
const baseUrl = siteConfig.baseUrl || 'https://pvaitshop.com/';
const paths = siteConfig.pathConfig || {
    product: 'product',
    category: 'category',
    blog: 'blog',
    sitemap: 'sitemap.xml'
};

/**
 * Helper to construct URLs dynamically from site_data.js config
 */
function getDynamicUrl(type, slug = '', isAbsolute = true) {
    const base = paths[type] || type;
    const cleanSlug = slug.replace(/^\/+|\/+$/g, '');
    
    let urlPath = '';
    if (type === 'home') {
        urlPath = '/';
    } else if (!cleanSlug) {
        urlPath = `/${base}/`;
    } else {
        urlPath = `/${base}/${cleanSlug}/`;
    }

    // Fix double slashes
    urlPath = urlPath.replace(/\/+/g, '/');

    if (isAbsolute) {
        return `${baseUrl.replace(/\/+$/, '')}${urlPath}`;
    }
    return urlPath;
}

if (!products || !siteConfig) {
    console.error("Failed to load data from site_data.js");
    process.exit(1);
}

console.log(`Loaded ${products.length} products and ${blogs.length} blog posts.`);

// --- Load Templates ---
const headerHtml = fs.readFileSync('header_partial.html', 'utf8');

// --- 2. Helper Functions ---

/**
 * Recursively deletes a directory and its contents
 * Robust version for Windows
 */
function cleanDirectory(dir) {
    if (fs.existsSync(dir)) {
        console.log(`Cleaning directory: ${dir}`);
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch (err) {
            console.warn(`Initial cleaning of ${dir} failed, retrying...`);
            // Small delay and retry for Windows file locks
            try {
                // On Windows, sometimes directories are "busy" for a split second
                // We'll try to delete contents individually if rmSync fails
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const curPath = path.join(dir, file);
                    if (fs.lstatSync(curPath).isDirectory()) {
                        cleanDirectory(curPath);
                    } else {
                        fs.unlinkSync(curPath);
                    }
                }
                fs.rmdirSync(dir);
            } catch (retryErr) {
                console.error(`Failed to clean directory ${dir}:`, retryErr.message);
            }
        }
    }
}

function generateFooter(products, siteConfig) {
    // Group products by category
    const categoriesGrouped = {};
    products.forEach(p => {
        if (!categoriesGrouped[p.category]) categoriesGrouped[p.category] = [];
        categoriesGrouped[p.category].push(p);
    });

    // Link to real category pages
    const categoryLinks = Object.keys(categoriesGrouped).slice(0, 5).map(catName => {
        const catData = categories.find(c => c.name === catName);
        if (!catData || !catData.slug) return '';
        const url = getDynamicUrl('category', catData.slug, false);
        return `<li><a href="${url}" class="text-slate-400 hover:text-cyan-400 transition-colors text-sm">${catName}</a></li>`;
    }).filter(Boolean).join('');

    const popularProducts = products.filter(p => p.is_sale).slice(0, 5).map(p => {
        const url = getDynamicUrl('product', p.slug, false);
        return `<li><a href="${url}" class="text-slate-400 hover:text-cyan-400 transition-colors text-sm">${p.display_title || p.title}</a></li>`;
    }).join('');

    const logoContent = siteConfig.logoUrl 
        ? `<img src="${siteConfig.logoUrl}" alt="${siteConfig.logoText || 'Logo'}" class="h-8 w-auto">`
        : `<span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 font-extrabold text-2xl tracking-tight">{{LOGO_TEXT}}</span>`;

    const siteDomain = (siteConfig.siteTitle || 'PvaitShop').toLowerCase().replace(/\s+/g, '') + '.com';

    return `
        <div class="max-w-7xl mx-auto px-4">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                <div class="col-span-1 md:col-span-1">
                    <div class="flex items-center gap-2 mb-4">
                        ${logoContent}
                    </div>
                    <p class="text-slate-500 text-sm leading-relaxed mb-4">
                        {{META_DESCRIPTION}}
                    </p>
                    <div class="flex gap-3">
                        <a href="https://facebook.com/${siteDomain.split('.')[0]}" target="_blank" rel="nofollow" class="text-slate-400 hover:text-white transition-colors" aria-label="Facebook"><i data-lucide="facebook" class="w-5 h-5"></i></a>
                        <a href="https://x.com/${siteDomain.split('.')[0]}" target="_blank" rel="nofollow" class="text-slate-400 hover:text-white transition-colors" aria-label="X (Twitter)"><i data-lucide="twitter" class="w-5 h-5"></i></a>
                        <a href="https://t.me/${(siteConfig.telegram || '').replace('@','')}" target="_blank" rel="nofollow" class="text-slate-400 hover:text-white transition-colors" aria-label="Telegram"><i data-lucide="send" class="w-5 h-5"></i></a>
                    </div>
                </div>
                
                <div>
                    <h4 class="text-white font-bold mb-4">Categories</h4>
                    <ul class="space-y-2">
                        ${categoryLinks}
                    </ul>
                </div>

                <div>
                    <h4 class="text-white font-bold mb-4">Popular Products</h4>
                    <ul class="space-y-2">
                        ${popularProducts}
                    </ul>
                </div>

                <div>
                    <h4 class="text-white font-bold mb-4">Contact Us</h4>
                    <ul class="space-y-2 text-sm text-slate-400">
                        <li class="flex items-center gap-2">
                            <i data-lucide="mail" class="w-4 h-4 text-cyan-500"></i> 
                            <a href="mailto:{{SUPPORT_EMAIL}}" class="hover:text-white transition-colors">{{SUPPORT_EMAIL}}</a>
                        </li>
                        <li class="flex items-center gap-2">
                            <i data-lucide="phone" class="w-4 h-4 text-green-500"></i> 
                            <a href="{{WHATSAPP_LINK}}" target="_blank" rel="nofollow" class="hover:text-white transition-colors">{{WHATSAPP}}</a>
                        </li>
                        <li class="flex items-center gap-2">
                            <i data-lucide="send" class="w-4 h-4 text-blue-500"></i> 
                            <a href="{{TELEGRAM_LINK}}" target="_blank" rel="nofollow" class="hover:text-white transition-colors">@{{TELEGRAM}}</a>
                        </li>
                    </ul>
                </div>
            </div>
            
            <div class="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <p class="text-slate-500 text-sm">Copyright © ${new Date().getFullYear()} ${siteDomain}. All rights reserved.</p>
                <div class="flex gap-4 text-sm text-slate-500">
                    <a href="${getDynamicUrl('blog', '', false)}" class="hover:text-white transition-colors">Blog</a>
                    <a href="#" class="hover:text-white transition-colors">Privacy Policy</a>
                    <a href="#" class="hover:text-white transition-colors">Terms of Service</a>
                </div>
            </div>
        </div>
    `;
}

function generateLatestArticlesHtml(blogs) {
    if (!blogs || blogs.length === 0) return '';
    const latest = blogs.slice(0, 3);
    const cards = latest.map(b => `
        <div class="group relative flex flex-col items-start bg-[#1E293B]/50 p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all">
            <div class="flex items-center gap-x-4 text-xs mb-3">
                <time datetime="${b.date}" class="text-slate-400">${b.date}</time>
                <span class="relative z-10 rounded-full bg-cyan-400/10 px-3 py-1.5 font-medium text-cyan-400">Article</span>
            </div>
            <h3 class="mt-0 text-lg font-bold leading-6 text-white group-hover:text-cyan-400 transition-colors">
                <a href="${getDynamicUrl('blog', b.slug, false)}">
                    <span class="absolute inset-0"></span>
                    ${b.title}
                </a>
            </h3>
            <p class="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">${b.excerpt}</p>
            <div class="mt-4 flex items-center gap-1 text-cyan-400 text-sm font-bold">
                Read More <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </div>
        </div>
    `).join('');

    return `
    <section class="py-16 bg-[#0B1120] border-t border-white/5">
        <div class="mx-auto max-w-7xl px-4">
            <div class="flex items-center justify-between mb-10">
                <div>
                    <h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">Latest <span class="text-cyan-400">Articles</span></h2>
                    <p class="mt-2 text-lg leading-8 text-slate-400">Expert tips and guides for your digital growth.</p>
                </div>
                <a href="${getDynamicUrl('blog', '', false)}" class="hidden sm:flex items-center gap-1 text-cyan-400 font-bold hover:text-cyan-300 transition-colors">View All <i data-lucide="arrow-right" class="w-4 h-4"></i></a>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                ${cards}
            </div>
            <div class="mt-8 text-center sm:hidden">
                 <a href="${getDynamicUrl('blog', '', false)}" class="inline-flex items-center gap-1 text-cyan-400 font-bold hover:text-cyan-300 transition-colors">View All Articles <i data-lucide="arrow-right" class="w-4 h-4"></i></a>
            </div>
        </div>
    </section>
    `;
}

function generateRelatedArticlesHtml(product, blogs) {
    if (!blogs || blogs.length === 0) return '';
    
    // 1. Priority: Explicitly related blogs (via related_ids in blog object)
    let related = blogs.filter(b => b.related_ids && b.related_ids.includes(product.id));

    // 2. Fallback: Contextual matching (Category/Title keywords)
    if (related.length < 3) {
        const productKeywords = product.category.toLowerCase().split(/[\s&]+/);
        const contextual = blogs.filter(b => {
            // Avoid duplicates
            if (related.some(rel => rel.id === b.id)) return false;
            
            const titleLower = b.title.toLowerCase();
            return productKeywords.some(k => titleLower.includes(k));
        });
        
        related = [...related, ...contextual];
    }

    const displayBlogs = related.slice(0, 3);
    
    if (displayBlogs.length === 0) return '';

    const title = 'Related Articles';

    const cards = displayBlogs.map(b => {
        const url = getDynamicUrl('blog', b.slug, false);
        return `
        <div class="group relative flex flex-col items-start bg-[#1E293B] p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all">
            <h3 class="text-lg font-bold leading-6 text-white group-hover:text-cyan-400 transition-colors">
                <a href="${url}">
                    <span class="absolute inset-0"></span>
                    ${b.title}
                </a>
            </h3>
            <p class="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">${b.excerpt}</p>
             <div class="mt-4 text-cyan-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Read Article <i data-lucide="arrow-right" class="w-3 h-3"></i>
            </div>
        </div>
    `}).join('');

    return `
    <div class="mt-16 border-t border-white/5 pt-12">
        <div class="flex items-center justify-between mb-8">
            <h2 class="text-2xl font-bold text-white">${title}</h2>
            <a href="${getDynamicUrl('blog', '', false)}" class="text-cyan-400 text-sm font-bold hover:underline">View Blog</a>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            ${cards}
        </div>
    </div>
    `;
}

function generateSocialShare(product) {
    const url = getDynamicUrl('product', product.slug, true);
    const title = encodeURIComponent(product.title);
    
    return `
        <a href="https://www.facebook.com/sharer/sharer.php?u=${url}" target="_blank" rel="noopener noreferrer" class="p-2 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] rounded-lg transition-colors" aria-label="Share on Facebook">
            <i data-lucide="facebook" class="w-5 h-5"></i>
        </a>
        <a href="https://twitter.com/intent/tweet?text=${title}&url=${url}" target="_blank" rel="noopener noreferrer" class="p-2 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] rounded-lg transition-colors" aria-label="Share on Twitter">
            <i data-lucide="twitter" class="w-5 h-5"></i>
        </a>
        <a href="https://wa.me/?text=${title}%20${url}" target="_blank" rel="noopener noreferrer" class="p-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-lg transition-colors" aria-label="Share on WhatsApp">
            <i data-lucide="message-circle" class="w-5 h-5"></i>
        </a>
        <a href="https://t.me/share/url?url=${url}&text=${title}" target="_blank" rel="noopener noreferrer" class="p-2 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] rounded-lg transition-colors" aria-label="Share on Telegram">
            <i data-lucide="send" class="w-5 h-5"></i>
        </a>
    `;
}

function replaceGlobalPlaceholders(html, siteConfig) {
    let output = html;
    output = output.replace(/{{WHATSAPP}}/g, siteConfig.whatsapp || '');
    output = output.replace(/{{TELEGRAM}}/g, (siteConfig.telegram || '').replace('@', ''));
    output = output.replace(/{{WHATSAPP_LINK}}/g, `https://wa.me/${(siteConfig.whatsapp || '').replace(/[^0-9]/g, '')}`);
    output = output.replace(/{{TELEGRAM_LINK}}/g, `https://t.me/${(siteConfig.telegram || '').replace('@', '')}`);
    output = output.replace(/{{SUPPORT_EMAIL}}/g, siteConfig.supportEmail || '');
    output = output.replace(/{{SITE_TITLE}}/g, siteConfig.siteTitle || 'PvaitShop');
    output = output.replace(/{{SITE_NAME}}/g, siteConfig.siteTitle || 'PvaitShop');
    output = output.replace(/{{SITE_DOMAIN}}/g, (siteConfig.siteTitle || 'PvaitShop').toLowerCase().replace(/\s+/g, '') + '.com');
    output = output.replace(/{{META_DESCRIPTION}}/g, siteConfig.metaDescription || '');
    output = output.replace(/{{LOGO_TEXT}}/g, siteConfig.logoText || 'PvaitShop');
    output = output.replace(/{{LOGO_BADGE}}/g, siteConfig.logoBadge || '');
    output = output.replace(/{{FAVICON_URL}}/g, siteConfig.faviconUrl || '/favicon.svg');
    output = output.replace(/{{LOGO_URL}}/g, siteConfig.logoUrl || '/favicon.svg');
    output = output.replace(/{{HERO_TITLE}}/g, siteConfig.heroTitle || '');
    output = output.replace(/{{HERO_SUBTITLE}}/g, siteConfig.heroSubtitle || '');
    output = output.replace(/{{HERO_BUTTON_TEXT}}/g, siteConfig.heroButtonText || 'Explore Services');
    output = output.replace(/{{POPUP_TITLE}}/g, siteConfig.popupTitle || 'Contact Support');
    output = output.replace(/{{POPUP_MESSAGE}}/g, siteConfig.popupMessage || "We're here to help! 24/7 Support Available.");
    output = output.replace(/{{BADGE_TEXT}}/g, siteConfig.badgeText || 'Premium Quality PVA Accounts & Reviews');
    
    // Handle Canonical URL dynamically
    output = output.replace(/{{CANONICAL_URL}}/g, getDynamicUrl('home'));
    
    return output;
}

function minifyHTML(html) {
    if (!html) return '';
    return html
        .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
        .replace(/\s+/g, ' ')            // Collapse whitespace
        .replace(/>\s+</g, '><')         // Remove space between tags
        .trim();
}

function renderStars(rating = 5, sizeClass = "w-4 h-4") {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        const isFull = i <= rating;
        const color = isFull ? '#facc15' : 'currentColor';
        const fill = isFull ? '#facc15' : 'none';
        const textClass = isFull ? 'text-yellow-400' : 'text-slate-600';
        html += `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star ${sizeClass} ${textClass}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }
    return html;
}

function getImageUrl(img, basePath = '/') {
    if (!img) return null;
    if (img.startsWith('http') || img.startsWith('data:') || img.startsWith('/')) return img;
    return `${basePath}images/products/${img}`;
}

function getProductSeed(product) {
    const n = Number(product && product.id);
    if (Number.isFinite(n)) return n;
    const str = String((product && (product.slug || product.title)) || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function hslToHex(h, s, l) {
    const sat = s / 100;
    const light = l / 100;
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r1 = 0, g1 = 0, b1 = 0;
    if (hp >= 0 && hp < 1) { r1 = c; g1 = x; b1 = 0; }
    else if (hp >= 1 && hp < 2) { r1 = x; g1 = c; b1 = 0; }
    else if (hp >= 2 && hp < 3) { r1 = 0; g1 = c; b1 = x; }
    else if (hp >= 3 && hp < 4) { r1 = 0; g1 = x; b1 = c; }
    else if (hp >= 4 && hp < 5) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    const m = light - c / 2;
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function computeProductColor(product) {
    const seed = getProductSeed(product);
    const hue = (seed * 137.508) % 360;
    /* Increased lightness for better vibrancy */
    return hslToHex(hue, 65, 45);
}

function renderProductCard(product, basePath = '/') {
    const fullImgUrl = getImageUrl(product.image, basePath);
    const imageHtml = fullImgUrl 
        ? `<img src="${fullImgUrl}" alt="${product.image_title || product.title}" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" width="400" height="300">`
        : '';
    const solidColor = computeProductColor(product);
    const overlayClass = fullImgUrl ? '' : 'bg-black/0 group-hover:bg-black/0';
    const productUrl = getDynamicUrl('product', product.slug, false);
    const overlayTitle = (product.display_title && product.display_title.trim().length > 0)
        ? product.display_title
        : product.title.replace(/^Buy\s+/i, '');

    const overlayLayerHtml = fullImgUrl ? '' : `<div class="absolute inset-0 ${overlayClass} transition-colors duration-300"></div>`;
    const overlayTextHtml = fullImgUrl ? '' : `
            <div class="absolute top-3 left-3 bg-red-500/90 backdrop-blur-md border border-white/20 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 shadow-lg z-10">
                <span class="text-yellow-300 text-sm">Sale!</span> PvaitShop
            </div>
            
            <h3 class="text-xl font-bold leading-tight text-white mb-4 drop-shadow-lg z-10 relative">${overlayTitle}</h3>
            
            <a href="${productUrl}" class="bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold px-5 py-2 rounded-full mb-2 cursor-pointer hover:bg-white/20 hover:scale-105 transition-all block text-center no-underline z-10">
                ORDER NOW
            </a>
    `;
    
    return `
    <div class="card-glow bg-[#1E293B] rounded-2xl border border-white/5 overflow-hidden transition-all duration-300 group hover:-translate-y-2" style="content-visibility: auto; contain-intrinsic-size: 0 350px;">
        <div role="img" aria-label="${product.image_title || product.title}" class="relative p-6 h-52 flex flex-col items-center justify-center text-center overflow-hidden" style="background-color: ${solidColor};">
            ${imageHtml}
            ${overlayLayerHtml}
            ${overlayTextHtml}
        </div>
        
        <div class="p-5">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded uppercase tracking-wider">${product.category}</span>
                <div class="flex items-center gap-0.5">
                    ${renderStars(5, "w-3 h-3")}
                </div>
            </div>
            
            <a href="${productUrl}" class="font-bold text-slate-100 mb-3 text-sm hover:text-cyan-400 transition-colors block line-clamp-2 min-h-[40px]">
                ${overlayTitle}
            </a>
            
            <div class="flex items-center justify-between mb-5">
                <p class="text-slate-400 text-xs">Starting from</p>
                <p class="text-white font-extrabold text-lg">
                    $${product.min_price.toFixed(2)}
                </p>
            </div>
            
            <a href="${productUrl}" class="block w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl py-3 text-center text-sm shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40">
                Order Now
            </a>
        </div>
    </div>`;
}

function generateRichDescription(product) {
    if (product.long_description) return product.long_description;
    
    const productName = product.title;
    return `
        <h2 class="text-xl md:text-2xl font-bold text-white mb-4">${productName} – Safe Online & Trusted Account</h2>
        <p class="mb-4">
            In the modern world of online business, having a reliable <strong>${productName}</strong> is crucial. 
            Whether you are an entrepreneur, a digital marketer, or a freelancer, verified accounts provide the stability and credibility you need. 
            At <strong class="text-cyan-400">PvaitShop</strong>, we provide premium, fully verified ${productName} that are ready to use. 
            Our accounts are safe, secure, and come with a replacement guarantee.
        </p>

        <h3 class="text-lg font-bold text-white mb-3 mt-8">Why is a ${productName} Best For Online Business?</h3>
        <p class="mb-4">
            Efficiency and authenticity are key factors for online success. Using verified accounts ensures that your business operations run smoothly without interruptions. 
            A ${productName} allows you to access features that might be restricted on unverified or new accounts.
        </p>
        <ul class="list-disc pl-5 space-y-2 mb-6 text-slate-300">
            <li><strong>Instant Access:</strong> No waiting time, get started immediately.</li>
            <li><strong>High Trust Score:</strong> Verified accounts carry more authority.</li>
            <li><strong>Security:</strong> Reduced risk of suspension or bans.</li>
        </ul>

        <h3 class="text-lg font-bold text-white mb-3 mt-8">Buy Trusted ${productName} For Secure Operations</h3>
        <p class="mb-4">
            When it comes to online transactions or marketing, security is paramount. 
            Buying trusted ${productName} from us ensures that you get a clean, high-quality account. 
            We use unique IPs and real device fingerprints to create these accounts, ensuring they look natural and authentic.
        </p>

        <h3 class="text-lg font-bold text-white mb-3 mt-8">How to Buy ${productName} Safely (Practical Steps)</h3>
        <p class="mb-4">
            When choosing a provider, safety should be your top priority. Here is why we are the best choice:
        </p>
        <ol class="list-decimal pl-5 space-y-2 mb-6 text-slate-300">
            <li><strong>Select Your Package:</strong> Choose the ${productName} package that fits your needs.</li>
            <li><strong>Secure Payment:</strong> We accept various secure payment methods including Crypto.</li>
            <li><strong>Instant Delivery:</strong> Receive your account details via email shortly after purchase.</li>
            <li><strong>24/7 Support:</strong> Our team is always ready to assist you.</li>
        </ol>

        <h3 class="text-lg font-bold text-white mb-3 mt-8">Conclusion</h3>
        <p class="mb-4">
            In conclusion, buying a ${productName} from PvaitShop is a smart investment for your digital growth. 
            Save time, avoid hassles, and focus on scaling your business while we handle the technicalities. 
            Order your ${productName} today and experience the difference!
        </p>
    `;
}

function generateFullHeader(unused_basePath, products, categories, siteConfig) {
    let header = fs.readFileSync('header_partial.html', 'utf8');
    
    // 1. Populate Desktop Nav
    let desktopNavHtml = `<a href="/" class="text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm font-medium px-4 py-2">Shop</a>`;
    
    categories.forEach(cat => {
        const catItemsHtml = cat.items.map(item => {
            const p = products.find(prod => prod.slug === item || prod.title === item || prod.image_title === item || prod.display_title === item);
            const url = p ? getDynamicUrl('product', p.slug, false) : '#';
            const displayText = p ? (p.display_title || p.title) : item;
            return `<a href="${url}" class="block px-4 py-2.5 text-sm text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors">${displayText}</a>`;
        }).join('');

        desktopNavHtml += `
            <div class="relative group px-3 py-2">
                <button class="text-slate-300 group-hover:text-cyan-400 text-sm font-medium flex items-center gap-1 transition-colors">
                    ${cat.name} <i data-lucide="chevron-down" class="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity"></i>
                </button>
                <div class="absolute left-0 mt-2 w-56 bg-[#0F172A] border border-white/10 rounded-xl shadow-2xl py-2 hidden group-hover:block z-50 backdrop-blur-xl max-h-96 overflow-y-auto">
                    ${catItemsHtml}
                </div>
            </div>
        `;
    });

    desktopNavHtml += `
        <a href="${getDynamicUrl('blog', '', false)}" class="text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm font-medium px-4 py-2">Blog</a>
    `;

    // 2. Populate Mobile Nav
    let mobileNavHtml = `
        <a href="${getDynamicUrl('blog', '', false)}" class="block px-4 py-3 text-white font-bold bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-xl mb-4 hover:bg-white/5 transition-all">
            <span class="flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4 text-cyan-400"></i> Blog</span>
        </a>
    `;

    categories.forEach(cat => {
        if (!cat.slug) return;
        const catSlug = cat.slug;
        const catItemsHtml = cat.items.map(item => {
            const p = products.find(prod => prod.slug === item || prod.title === item || prod.image_title === item || prod.display_title === item);
            const url = p ? getDynamicUrl('product', p.slug, false) : '#';
            const displayText = p ? (p.display_title || p.title) : item;
            return `<a href="${url}" class="block px-4 py-2 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors text-sm">${displayText}</a>`;
        }).join('');

        mobileNavHtml += `
            <div class="mb-2">
                <button class="mobile-cat-toggle w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:text-cyan-400 hover:bg-white/5 rounded-xl transition-all" data-cat="${catSlug}">
                    <span class="font-bold text-sm tracking-wide uppercase">${cat.name}</span>
                    <i data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-200"></i>
                </button>
                <div id="mobile-items-${catSlug}" class="hidden space-y-1 mt-1 ml-4 border-l border-white/10 pl-2">
                    <a href="${getDynamicUrl('category', catSlug, false)}" class="block px-4 py-2 text-xs font-bold text-cyan-500 hover:text-cyan-400 uppercase tracking-widest">View All ${cat.name}</a>
                    ${catItemsHtml}
                </div>
            </div>
        `;
    });

    header = header.replace(/<nav[^>]*id="desktop-nav">[\s\S]*?<\/nav>/, `<nav class="desktop-nav-container items-center gap-1" id="desktop-nav">${desktopNavHtml}</nav>`);
    header = header.replace(/<div[^>]*id="mobile-nav-items">[\s\S]*?<\/div>/, `<div class="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide" id="mobile-nav-items">${mobileNavHtml}</div>`);
    
    // Replace site config placeholders
    header = header.replace(/{{LOGO_TEXT}}/g, siteConfig.logoText);
    
    return header;
}

console.log("Reading output.css for Critical CSS inlining...");
let cssContent = fs.readFileSync('output.css', 'utf8');

// --- Fix CSS Linter Warnings in inlined CSS ---
// 0. Strip CSS comments to avoid regex issues
cssContent = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');

// 1. Fix line-clamp compatibility
cssContent = cssContent.replace(/-webkit-line-clamp:\s*(\d+)/g, '-webkit-line-clamp: $1; line-clamp: $1');
// 2. Fix appearance compatibility (ensuring standard property is present)
cssContent = cssContent.replace(/(-webkit-appearance|-moz-appearance):\s*([^;! }]+)/g, (match, p1, p2) => {
    return `${p1}: ${p2}; appearance: ${p2}`;
});
// Remove any resulting duplicates like "appearance: none; appearance: none"
cssContent = cssContent.replace(/(appearance:\s*[^;! }]+);\s*appearance:\s*\1/g, '$1');

// 3. Fix "vertical-align ignored" warning in Tailwind reset
cssContent = cssContent.replace(/(canvas|audio|iframe|embed|object)[^{]*\{[^}]*display:\s*block;?[^}]*vertical-align:\s*middle;?[^}]*\}/g, (match) => {
    return match.replace(/vertical-align:\s*middle;?/g, '');
});

console.log("Reading header_partial.html...");
// We will generate the header dynamically for each page using generateFullHeader()

// --- 3. Build Homepage ---
console.log("Building Homepage...");
const indexTemplate = fs.readFileSync('site_template.html', 'utf8'); // Keep master template in memory
let indexHtml = indexTemplate;

// Inject Header
indexHtml = indexHtml.replace('{{HEADER}}', generateFullHeader('./', products, categories, siteConfig));

// Generate Category Options for Homepage Search
const categoryOptions = `
    <option value="All Categories">All Categories</option>
    ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('\n    ')}
`;
indexHtml = indexHtml.replace('{{CATEGORY_OPTIONS}}', categoryOptions);

// Generate Product Grid
const productGridHtml = products.map((p, idx) => {
    const card = renderProductCard(p, '');
    // Prioritize first 4 products on homepage for LCP/SI
    if (idx < 4) {
        return card.replace('loading="lazy"', 'fetchpriority="high"').replace('width="400" height="300"', 'width="400" height="300" fetchpriority="high"');
    }
    return card;
}).join('\n');
indexHtml = indexHtml.replace('{{PRODUCT_GRID}}', `
    <div id="product-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        ${productGridHtml}
    </div>
`);

// Generate Footer
indexHtml = indexHtml.replace('{{FOOTER}}', generateFooter(products, siteConfig));

// Generate Latest Articles
indexHtml = indexHtml.replace('{{LATEST_ARTICLES}}', generateLatestArticlesHtml(blogs));

// Inline Critical CSS
indexHtml = indexHtml.replace(/{{CRITICAL_CSS}}/g, `<style>${cssContent}</style>`);

// Preload first 2 product images for LCP
const homepagePreload = products.slice(0, 2).map(p => `<link rel="preload" href="${getImageUrl(p.image)}" as="image" fetchpriority="high">`).join('');
indexHtml = indexHtml.replace('{{PRODUCT_IMAGE_PRELOAD}}', homepagePreload);

// Global Placeholders
indexHtml = indexHtml.replace(/{{CANONICAL_URL}}/g, 'https://pvaitshop.com/');
indexHtml = replaceGlobalPlaceholders(indexHtml, siteConfig);

// Save Homepage
fs.writeFileSync('index.html', indexHtml);
console.log("Homepage built.");

// --- 3.1 Build Category Pages ---
console.log("Building Category Pages...");
cleanDirectory('category');
const uniqueCategories = [...new Set(products.map(p => p.category))];
let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

// Add Homepage to Sitemap
sitemap += '  <url>\n';
sitemap += '    <loc>https://pvaitshop.com/</loc>\n';
sitemap += '    <lastmod>' + new Date().toISOString().split('T')[0] + '</lastmod>\n';
sitemap += '    <priority>1.0</priority>\n';
sitemap += '  </url>\n';

uniqueCategories.forEach(cat => {
        const catData = categories.find(c => c.name === cat);
        if (!catData || !catData.slug) {
            console.warn(`Category "${cat}" has no slug defined in site_data.js. Skipping page generation.`);
            return;
        }
        const slug = catData.slug;
        const dir = path.join(paths.category, slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Find category data from site_data (now we have rich content there)
    const categoryData = categories.find(c => c.name === cat) || {};
    const richContent = categoryData.content || '';
    const catDescription = categoryData.description || `Buy verified ${cat} accounts and reviews. Secure, fast, and trusted services for ${cat} marketing.`;

    let catHtml = indexTemplate;
    // Inject Header for Category Pages
    catHtml = catHtml.replace('{{HEADER}}', generateFullHeader('../../', products, categories, siteConfig));
    
    // SEO & Hero
    const catTitle = `${cat} Accounts & Reviews | PvaitShop`;
    
    // Replace Category Options
    catHtml = catHtml.replace('{{CATEGORY_OPTIONS}}', categoryOptions);

    // Replace Hero with Category Title
    catHtml = catHtml.replace('{{HERO_TITLE}}', `<span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">${cat}</span> Services`);
    catHtml = catHtml.replace('{{HERO_SUBTITLE}}', catDescription);
    
    // Override Global SEO for Category
    catHtml = catHtml.replace(/{{SITE_TITLE}}/g, catTitle);
    catHtml = catHtml.replace(/{{META_DESCRIPTION}}/g, catDescription);

    // SEO URL Fixes
    const catUrl = getDynamicUrl('category', slug);
    catHtml = catHtml.replace(/{{CANONICAL_URL}}/g, catUrl);
    
    // Filter Products
    const catProducts = products.filter(p => p.category === cat);
    const catGrid = catProducts.map((p, idx) => {
        const card = renderProductCard(p, '../../');
        // Prioritize first 4 products for LCP/SI
        if (idx < 4) {
            return card.replace('loading="lazy"', 'fetchpriority="high"').replace('width="400" height="300"', 'width="400" height="300" fetchpriority="high"');
        }
        return card;
    }).join('\n');
    
    const contentAndGrid = `
        <div class="max-w-7xl mx-auto px-4 mb-16 prose prose-invert lg:prose-xl">
            ${richContent}
        </div>
        <div class="max-w-7xl mx-auto px-4 mb-8">
            <h3 class="text-2xl font-bold text-white border-l-4 border-cyan-500 pl-4">Available Packages</h3>
        </div>
        <div id="product-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            ${catGrid}
        </div>
    `;

    catHtml = catHtml.replace('{{PRODUCT_GRID}}', contentAndGrid);
    
    // Latest Articles
    catHtml = catHtml.replace('{{LATEST_ARTICLES}}', generateLatestArticlesHtml(blogs));
    
    // Footer
    catHtml = catHtml.replace('{{FOOTER}}', generateFooter(products, siteConfig).replace(new RegExp(`href="/${paths.product}`, 'g'), `href="../../${paths.product}`).replace(/href="#"/g, 'href="../../"'));

    // CSS
    catHtml = catHtml.replace(/{{CRITICAL_CSS}}/g, `<style>${cssContent}</style>`);
    
    // Preload first 2 product images for LCP
    const catPreload = catProducts.slice(0, 2)
        .map(p => {
            const url = getImageUrl(p.image);
            return url ? `<link rel="preload" href="${url}" as="image" fetchpriority="high">` : '';
        })
        .filter(Boolean)
        .join('');
    catHtml = catHtml.replace('{{PRODUCT_IMAGE_PRELOAD}}', catPreload);

    // Global Placeholders
    catHtml = replaceGlobalPlaceholders(catHtml, siteConfig);

    fs.writeFileSync(path.join(dir, 'index.html'), minifyHTML(catHtml));

    // Sitemap
    sitemap += '  <url>\n';
    sitemap += `    <loc>${getDynamicUrl('category', slug)}</loc>\n`;
    sitemap += '    <lastmod>' + new Date().toISOString().split('T')[0] + '</lastmod>\n';
    sitemap += '    <priority>0.9</priority>\n';
    sitemap += '  </url>\n';
});

// --- 3.2 Build Blog Listing & Posts ---
console.log("Building Blog Pages...");
cleanDirectory(paths.blog);
const blogDir = paths.blog;
if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir);

// Pagination Settings
const postsPerPage = 6;
const totalPages = Math.ceil(blogs.length / postsPerPage);

// Helper: Generate Sidebar
function generateSidebar(products, blogs) {
    const popularBlogs = blogs.slice(0, 3).map(b => `
        <li class="flex gap-3 items-start">
             <div class="w-16 h-16 bg-slate-700 rounded-lg overflow-hidden shrink-0">
                <img src="${b.image}" alt="${b.title}" class="w-full h-full object-cover opacity-80 hover:opacity-100 transition">
             </div>
             <div>
                 <a href="${getDynamicUrl('blog', b.slug, false)}" class="text-sm font-bold text-slate-200 hover:text-cyan-400 leading-tight block mb-1">${b.title}</a>
                 <span class="text-xs text-slate-500">${b.date}</span>
             </div>
        </li>
    `).join('');

    const bestSellers = products.filter(p => p.is_sale).slice(0, 3).map(p => `
        <li class="flex items-center gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
             <div class="w-10 h-10 bg-gradient-to-br ${gradients[p.badge_color] || gradients.blue} rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">
                ${p.category.substring(0,2).toUpperCase()}
             </div>
             <div>
                 <a href="${getDynamicUrl('product', p.slug, false)}" class="text-sm font-bold text-slate-200 hover:text-cyan-400 block">${p.title}</a>
                 <span class="text-xs font-bold text-cyan-500">$${p.min_price}</span>
             </div>
        </li>
    `).join('');

    return `
        <!-- Popular Guides -->
        <div class="bg-[#1E293B] p-6 rounded-xl border border-white/5">
            <h3 class="font-bold text-white mb-4 border-b border-white/10 pb-2">Popular Guides</h3>
            <ul class="space-y-4">
               ${popularBlogs}
            </ul>
        </div>

        <!-- Trusted Products -->
        <div class="bg-[#1E293B] p-6 rounded-xl border border-white/5">
             <h3 class="font-bold text-white mb-4 border-b border-white/10 pb-2">Best Sellers</h3>
             <ul class="space-y-3">
                 ${bestSellers}
             </ul>
        </div>

        <!-- CTA Box -->
        <div class="bg-gradient-to-br from-cyan-600 to-blue-700 p-6 rounded-xl text-center shadow-lg shadow-cyan-500/20">
            <h3 class="font-bold text-white mb-2 text-lg">Need Verified Accounts?</h3>
            <p class="text-white/90 text-sm mb-6">Get premium, phone-verified accounts for Google, Facebook, and more instantly.</p>
            <a href="/" class="block bg-white text-blue-700 font-bold py-3 rounded-lg hover:bg-slate-100 transition-colors shadow-md">
                View All Products
            </a>
        </div>
    `;
}

// Helper: Inject CTA (Replaces [[CTA1]] and [[CTA2]])
function injectCTA(content, post) {
    const generateHTML = (text, link) => `
        <div class="my-10 bg-gradient-to-r from-slate-800 to-slate-900 border-l-4 border-cyan-500 p-6 rounded-r-xl shadow-lg">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="text-center sm:text-left">
                    <h4 class="text-lg font-bold text-white mb-1">Looking for verified accounts?</h4>
                    <p class="text-slate-400 text-sm">${text || "Get Verified PVA Accounts Now"}</p>
                </div>
                <a href="${link || "/"}" class="shrink-0 bg-cyan-500 hover:bg-cyan-400 text-white font-bold py-2.5 px-6 rounded-lg transition-all shadow-lg shadow-cyan-500/20 whitespace-nowrap">
                    Check Availability &rarr;
                </a>
            </div>
        </div>
    `;

    let newContent = content;
    let hasReplacement = false;

    if (newContent.includes('[[CTA1]]')) {
        newContent = newContent.replace('[[CTA1]]', generateHTML(post.cta_1_text, post.cta_1_link));
        hasReplacement = true;
    }

    if (newContent.includes('[[CTA2]]')) {
        newContent = newContent.replace('[[CTA2]]', generateHTML(post.cta_2_text, post.cta_2_link));
        hasReplacement = true;
    }

    // Fallback for older posts without placeholders: Insert after 2nd paragraph
    if (!hasReplacement && !newContent.includes('[[CTA')) {
         const parts = newContent.split('</p>');
         if (parts.length > 2) {
             const ctaHtml = generateHTML("Get Verified PVA Accounts Now", `/${paths.category}/accounts/`);
             const firstPart = parts.slice(0, 2).join('</p>') + '</p>';
             const restPart = parts.slice(2).join('</p>');
             return firstPart + ctaHtml + restPart;
         }
    }

    return newContent;
}

// Helper: Internal link 41 products across 5 blogs
function distributeProductsToBlog(content, products, blogIndex, totalBlogs) {
    // 1. Auto-link product titles found in text
    let processedContent = content;
    const sortedProducts = [...products].sort((a, b) => b.title.length - a.title.length);
    
    sortedProducts.forEach(product => {
        const escapedTitle = product.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Improved Regex: Avoids linking inside existing <a> tags or HTML attributes (like alt, title, src)
        // Matches the title only if it's not preceded by = " or ' (attributes) or inside <a> tags
        const regex = new RegExp(`(?<![="'>])\\b(${escapedTitle})\\b(?![^<]*>|[^<]*<\\/a>)`, 'gi');
        const url = getDynamicUrl('product', product.slug, false);
        processedContent = processedContent.replace(regex, `<a href="${url}" class="text-cyan-400 font-bold hover:underline">$1</a>`);
    });

    // 2. Append assigned subset of products at the bottom
    const productsPerBlog = Math.ceil(products.length / totalBlogs);
    const start = blogIndex * productsPerBlog;
    const end = Math.min(start + productsPerBlog, products.length);
    const assignedProducts = products.slice(start, end);
    
    if (assignedProducts.length > 0) {
        let productsHtml = `
            <div class="mt-16 p-8 bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl"></div>
                <h3 class="text-2xl font-black text-white mb-8 flex items-center gap-3">
                    <span class="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <i data-lucide="shopping-bag" class="w-4 h-4 text-white"></i>
                    </span>
                    Our <span class="text-cyan-400">Featured Services</span>
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        `;
        
        assignedProducts.forEach(p => {
            const url = getDynamicUrl('product', p.slug, false);
            productsHtml += `
                <a href="${url}" class="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 group hover:border-cyan-500/30">
                    <div class="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                        <i data-lucide="star" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-slate-200 group-hover:text-cyan-400 transition-colors leading-tight">${p.title}</p>
                        <p class="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">Available Now</p>
                    </div>
                </a>
            `;
        });
        
        productsHtml += `
                </div>
                <div class="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p class="text-slate-400 text-sm italic">Trusted by 5,000+ happy customers worldwide.</p>
                    <a href="/" class="group px-6 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20">
                        Explore All 41 Services <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
                    </a>
                </div>
            </div>
        `;
        processedContent += productsHtml;
    }
    
    return processedContent;
}

// Build Pagination Pages
for (let i = 1; i <= totalPages; i++) {
    const start = (i - 1) * postsPerPage;
    const end = start + postsPerPage;
    const pageBlogs = blogs.slice(start, end);
    
    // Create Page Directory: /blog/page/2/ etc.
    let pageDir = blogDir;
    let pageRelPath = '../'; // Default for /blog/index.html
    
    if (i > 1) {
        pageDir = path.join(blogDir, 'page', i.toString());
        if (!fs.existsSync(pageDir)) fs.mkdirSync(pageDir, { recursive: true });
        pageRelPath = '../../../'; // For /blog/page/2/index.html
    }

    let blogListHtml = indexTemplate;
    blogListHtml = blogListHtml.replace('{{HEADER}}', generateFullHeader(pageRelPath, products, categories, siteConfig));
    
    // Replace Category Options
    blogListHtml = blogListHtml.replace('{{CATEGORY_OPTIONS}}', categoryOptions);

    const pageTitleSuffix = i > 1 ? ` - Page ${i}` : '';
    const blogTitle = `PvaitShop Blog – Digital Marketing Tips${pageTitleSuffix}`;
    const blogDesc = 'Unlock the secrets of digital marketing. Expert strategies, safety tips, and growth hacks for your business.';

    // Enhanced Hero for Blog
    blogListHtml = blogListHtml.replace('{{HERO_TITLE}}', `
        <span class="block text-cyan-400 text-lg font-bold tracking-widest uppercase mb-4">Our Blog</span>
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-blue-200 drop-shadow-sm">Latest Insights & Guides</span>${pageTitleSuffix}
    `);
    blogListHtml = blogListHtml.replace('{{HERO_SUBTITLE}}', blogDesc);
    
    // Override Global SEO for Blog
    blogListHtml = blogListHtml.replace(/{{SITE_TITLE}}/g, blogTitle);
    blogListHtml = blogListHtml.replace(/{{META_DESCRIPTION}}/g, blogDesc);

    // SEO URL Fixes
    const canonicalUrl = i === 1 ? getDynamicUrl('blog') : `${getDynamicUrl('blog')}page/${i}/`;
    blogListHtml = blogListHtml.replace(/{{CANONICAL_URL}}/g, canonicalUrl);
    
    // Redesigned Eye-Catching Grid Layout
    const blogGrid = pageBlogs.map((b, idx) => `
        <article class="group relative flex flex-col bg-[#0F172A] rounded-3xl border border-white/5 overflow-hidden transition-all duration-500 hover:border-cyan-500/50 hover:shadow-[0_0_50px_-12px_rgba(6,182,212,0.25)] hover:-translate-y-2 h-full">
            <a href="${getDynamicUrl('blog', b.slug).replace(baseUrl, '/')}" class="h-64 overflow-hidden relative block">
                <img src="${b.image || 'https://via.placeholder.com/600x400?text=No+Image'}" alt="${b.title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" ${i === 1 && idx === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} width="600" height="400">
                <div class="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-transparent opacity-80"></div>
                
                <!-- Floating Date Badge -->
                <div class="absolute top-4 left-4 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-2">
                    <i data-lucide="calendar" class="w-3 h-3 text-cyan-400"></i> ${b.date}
                </div>
            </a>
            
            <div class="p-8 flex-1 flex flex-col relative">
                <!-- Decorative Glow -->
                <div class="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all"></div>

                <div class="mb-4">
                    <span class="text-xs font-bold text-cyan-400 tracking-widest uppercase border border-cyan-500/20 px-2 py-1 rounded">Article</span>
                </div>

                <h3 class="text-2xl font-bold text-white mb-4 leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-blue-400 transition-all">
                    <a href="${getDynamicUrl('blog', b.slug).replace(baseUrl, '/')}">
                        <span class="absolute inset-0"></span>
                        ${b.title}
                    </a>
                </h3>
                
                <p class="text-slate-400 text-sm mb-8 line-clamp-3 leading-relaxed flex-1 group-hover:text-slate-300 transition-colors">${b.excerpt}</p>
                
                <div class="flex items-center justify-between mt-auto pt-6 border-t border-white/5 group-hover:border-cyan-500/20 transition-colors">
                    <span class="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">Read Article</span>
                    <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300 group-hover:scale-110">
                        <i data-lucide="arrow-right" class="w-5 h-5"></i>
                    </div>
                </div>
            </div>
        </article>
    `).join('\n');

    // Pagination Controls
    let paginationHtml = '<div class="flex justify-center items-center gap-2 mt-12">';
    if (i > 1) {
        const prevLink = i === 2 ? `/${paths.blog}/` : `/${paths.blog}/page/${i-1}/`;
        paginationHtml += `<a href="${prevLink}" class="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-cyan-600 transition font-bold text-sm">Previous</a>`;
    }
    for (let p = 1; p <= totalPages; p++) {
        const activeClass = p === i ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700';
        const link = p === 1 ? `/${paths.blog}/` : `/${paths.blog}/page/${p}/`;
        paginationHtml += `<a href="${link}" class="w-10 h-10 flex items-center justify-center rounded-lg ${activeClass} font-bold text-sm transition">${p}</a>`;
    }
    if (i < totalPages) {
        paginationHtml += `<a href="/${paths.blog}/page/${i+1}/" class="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-cyan-600 transition font-bold text-sm">Next</a>`;
    }
    paginationHtml += '</div>';

    blogListHtml = blogListHtml.replace('{{PRODUCT_GRID}}', `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            ${blogGrid}
        </div>
        ${paginationHtml}
    `);
    blogListHtml = blogListHtml.replace('{{LATEST_ARTICLES}}', ''); 
    blogListHtml = blogListHtml.replace('{{PRODUCT_IMAGE_PRELOAD}}', '');

    // Footer & Links
    blogListHtml = blogListHtml.replace('{{FOOTER}}', generateFooter(products, siteConfig));
    blogListHtml = blogListHtml.replace(/{{CRITICAL_CSS}}/g, `<style>${cssContent}</style>`);
    
    // Global Placeholders
    blogListHtml = replaceGlobalPlaceholders(blogListHtml, siteConfig);

    fs.writeFileSync(path.join(pageDir, 'index.html'), minifyHTML(blogListHtml));
}

// Sitemap Entry for Blog
sitemap += '  <url>\n';
sitemap += `    <loc>${getDynamicUrl('blog')}</loc>\n`;
sitemap += '    <lastmod>' + new Date().toISOString().split('T')[0] + '</lastmod>\n';
sitemap += '    <priority>0.8</priority>\n';
sitemap += '  </url>\n';

// Single Blog Posts
blogs.forEach((post, index) => {
    const dir = path.join(paths.blog, post.slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const sidebarHtml = generateSidebar(products, blogs);
    // Modified to pass full post object for double CTA replacement
    let contentWithCta = injectCTA(post.content, post);
    
    // Internal link products (distribute 41 products across 5 blogs)
    contentWithCta = distributeProductsToBlog(contentWithCta, products, index, blogs.length);
    
    // Related Articles (Trust Section)
    const relatedHtml = generateRelatedArticlesHtml({ id: -1, category: 'General' }, blogs.filter(b => b.id !== post.id)); // Fallback related

    const blogPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${post.title} - PvaitShop</title>
    <meta name="description" content="${post.excerpt}">
    <link rel="canonical" href="${getDynamicUrl('blog', post.slug)}" />
    <meta name="robots" content="index, follow" />
    <style>${cssContent}</style>
    <style>
        /* Robust Navigation Visibility */
        .desktop-nav-container { display: none !important; }
        .mobile-menu-btn-container { display: block !important; }

        @media (min-width: 768px) {
            .desktop-nav-container { display: flex !important; }
            .mobile-menu-btn-container { display: none !important; }
        }
    </style>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest" defer></script>
</head>
<body class="bg-[#0B1120] text-slate-200 font-sans antialiased">
    ${generateFullHeader('../../', products, categories, siteConfig)}

    <!-- Header Spacing -->
    <div class="h-24"></div>

    <main class="max-w-7xl mx-auto px-4 py-8">
        <!-- Breadcrumb -->
        <nav class="flex text-sm text-slate-400 mb-8 overflow-x-auto whitespace-nowrap">
            <a href="/" class="hover:text-white">Home</a>
            <span class="mx-2">/</span>
            <a href="/${paths.blog}/" class="hover:text-white">Blog</a>
            <span class="mx-2">/</span>
            <span class="text-cyan-400 truncate">${post.title}</span>
        </nav>

        <div class="flex flex-col lg:flex-row gap-12">
            <!-- Main Content (70%) -->
            <article class="lg:w-[70%]">
                <header class="mb-8">
                    <span class="text-cyan-400 font-bold tracking-wider text-sm uppercase mb-3 block">${post.date}</span>
                    <h1 class="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight">${post.title}</h1>
                    <p class="text-xl text-slate-300 leading-relaxed border-l-4 border-cyan-500 pl-4 italic">
                        ${post.excerpt}
                    </p>
                </header>

                ${post.image ? `<img src="${post.image}" alt="${post.title}" class="w-full rounded-2xl mb-10 shadow-2xl border border-white/5" fetchpriority="high" width="1200" height="630">` : ''}

                <div class="prose prose-invert lg:prose-xl max-w-none prose-headings:text-white prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white">
                    ${contentWithCta}
                </div>

                <!-- Trust Section / Related -->
                ${relatedHtml}

                <div class="mt-12 pt-8 border-t border-white/10 flex justify-between items-center">
                    <a href="/${paths.blog}/" class="font-bold text-slate-400 hover:text-white flex items-center gap-2">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i> Back to Blog
                    </a>
                </div>
            </article>

            <!-- Sidebar (30%) -->
            <aside class="lg:w-[30%] space-y-8">
                ${sidebarHtml}
            </aside>
        </div>
    </main>

    <footer class="bg-[#0F172A] border-t border-white/5 py-12 mt-20">
        ${generateFooter(products, siteConfig).replace(new RegExp(`href="/${paths.product}`, 'g'), `href="../../${paths.product}`).replace(/href="#"/g, 'href="../../"')}
    </footer>

    <!-- Scripts -->
    <script>
        document.write('<script src="../../site_data.js?v=' + Date.now() + '"><\\/script>');
        document.write('<script src="../../ui.js?v=' + Date.now() + '"><\\/script>');
    </script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    </script>
</body>
</html>`;

    let finalBlogPageHtml = blogPageHtml;
    
    // Global Placeholders
    finalBlogPageHtml = replaceGlobalPlaceholders(finalBlogPageHtml, siteConfig);

    fs.writeFileSync(path.join(dir, 'index.html'), minifyHTML(finalBlogPageHtml));

    sitemap += '  <url>\n';
    sitemap += `    <loc>${getDynamicUrl('blog', post.slug)}</loc>\n`;
    sitemap += '    <lastmod>' + new Date().toISOString().split('T')[0] + '</lastmod>\n';
    sitemap += '    <priority>0.7</priority>\n';
    sitemap += '  </url>\n';
});

console.log("Building Product Pages...");
cleanDirectory(paths.product);
const productTemplate = fs.readFileSync('product_template.html', 'utf8');

const productCssContent = cssContent;

products.forEach(product => {
    if (!product.slug) return;

    // --- Sitemap ---
    sitemap += '  <url>\n';
    sitemap += `    <loc>${getDynamicUrl('product', product.slug)}</loc>\n`;
    sitemap += '    <lastmod>' + new Date().toISOString().split('T')[0] + '</lastmod>\n';
    sitemap += '    <priority>0.8</priority>\n';
    sitemap += '  </url>\n';

    // --- Prepare Data ---
    const slug = product.slug.trim().replace(/^\/+|\/+$/g, ''); 
    const solidColor = computeProductColor(product);
    const featuresList = product.features.map(f => 
        `<li class="flex items-start gap-2 text-slate-300 text-sm"><i data-lucide="check-circle-2" class="w-4 h-4 text-cyan-400 mt-0.5 shrink-0"></i> ${f}</li>`
    ).join('');
    const bottomFeaturesList = product.features.map(f => 
        `<li class="flex items-start gap-2 text-slate-400 text-sm"><i data-lucide="check" class="w-4 h-4 text-cyan-500 mt-0.5 shrink-0"></i> ${f}</li>`
    ).join('');
    
    let pricingOptions = '<option selected disabled>Choose an option</option>';
    if (product.pricing) {
        pricingOptions += product.pricing.map(p => `<option value="${p}">${p}</option>`).join('');
    }

    // Related Products
    let related = [];
    if (product.related_ids && product.related_ids.length > 0) {
        related = products.filter(p => product.related_ids.includes(p.id));
    }
    if (related.length === 0) {
        related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
    }
    const relatedHtml = related.map(p => {
        const relColor = computeProductColor(p);
        const relSlug = p.slug.replace(/^\/+|\/+$/g, '');
        const relUrl = getDynamicUrl('product', relSlug, false);
        const relImgUrl = getImageUrl(p.image, '../../');
        const relImgHtml = relImgUrl 
            ? `<img src="${relImgUrl}" alt="${p.image_title || p.title}" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" width="400" height="300">`
            : '';
        const relOverlayClass = relImgUrl ? '' : 'bg-black/0 group-hover:bg-black/0';
        const relOverlayLayerHtml = relImgUrl ? '' : `<div class="absolute inset-0 ${relOverlayClass} transition-colors duration-300"></div>`;
        const relOverlayTextHtml = relImgUrl ? '' : `
                    <div class="absolute top-2 left-2 bg-red-500/90 backdrop-blur-md border border-white/10 text-xs font-bold px-3 py-1 rounded flex gap-1 z-10">
                        <span class="text-yellow-300 text-sm">Sale!</span> PvaitShop
                    </div>
                    <h3 class="font-bold text-lg leading-tight mb-2 px-2 drop-shadow-md z-10 relative">${p.display_title || p.title.replace(/^Buy\s+/i, '')}</h3>
                    <div class="bg-white/10 hover:bg-white/20 text-xs font-bold px-4 py-1.5 rounded-full cursor-pointer transition-colors border border-white/20 z-10">ORDER NOW</div>
        `;

        return `
            <div class="card-glow bg-[#1E293B] rounded-xl border border-white/5 overflow-hidden transition-all duration-300 group hover:-translate-y-2" style="content-visibility: auto; contain-intrinsic-size: 0 350px;">
                <div role="img" aria-label="${p.image_title || p.title}" class="p-4 h-44 relative flex flex-col items-center justify-center text-center text-white group-hover:scale-105 transition-transform duration-500" style="background-color: ${relColor};">
                    ${relImgHtml}
                    ${relOverlayLayerHtml}
                    ${relOverlayTextHtml}
                </div>
                <div class="p-4">
                    <p class="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1">${p.category}</p>
                    <a href="${relUrl}" class="font-bold text-slate-100 text-sm mb-2 block hover:text-cyan-400 transition-colors truncate">${p.title}</a>
                    <div class="flex gap-0.5 mb-3">
                        ${renderStars(5, "w-3 h-3")} 
                    </div>
                    <div class="text-white text-sm mb-4 font-extrabold">$${p.min_price.toFixed(2)} - $${p.max_price.toFixed(2)}</div>
                    <a href="${relUrl}" class="block w-full bg-white/5 hover:bg-cyan-600 text-white text-center py-3.5 rounded-lg text-sm font-bold transition-all border border-white/10 hover:border-cyan-500">Order Now</a>
                </div>
            </div>`;
    }).join('');

    // Reviews
    const pReviews = reviewsData ? reviewsData.filter(r => r.productId === product.id) : [];
    let reviewsHtml = '';
    if (pReviews.length === 0) {
        reviewsHtml = '<div class="text-center py-10 bg-[#0F172A] rounded-xl border border-white/5"><p class="text-slate-400 mb-2">No reviews yet.</p><p class="text-sm text-slate-500">Be the first to write a review!</p></div>';
    } else {
        reviewsHtml = pReviews.map(r => `
            <div class="bg-[#0F172A] p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/5 group">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-black text-lg border-2 border-white/10 shadow-lg group-hover:scale-110 transition-transform duration-300">
                            ${r.avatar || (r.user ? r.user.charAt(0).toUpperCase() : 'U')}
                        </div>
                        <div>
                            <h4 class="font-bold text-white text-base mb-0.5">${r.user}</h4>
                            <div class="flex items-center gap-2 text-xs font-medium text-slate-500">
                                <span>${r.date}</span>
                                ${r.verified !== false ? `
                                <span class="text-cyan-400 flex items-center gap-1 bg-cyan-400/10 px-2 py-0.5 rounded-full text-[10px] border border-cyan-400/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-badge-check w-3 h-3"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.74Z"/><path d="m9 12 2 2 4-4"/></svg> Verified Buyer
                                </span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-0.5 bg-white/5 p-1.5 rounded-lg">
                        ${renderStars(r.rating, "w-3 h-3")}
                    </div>
                </div>
                ${r.title ? `<h5 class="text-white font-bold text-base mb-2 group-hover:text-cyan-400 transition-colors">${r.title}</h5>` : ''}
                <p class="text-slate-400 text-sm leading-relaxed opacity-90 group-hover:opacity-100 transition-opacity">${r.text}</p>
            </div>
        `).join('');
    }

    // JSON-LD
    const jsonLd = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.title,
        "description": product.meta_description || product.short_description,
        "sku": String(product.id),
        "brand": { "@type": "Brand", "name": "PvaitShop" },
        "offers": {
            "@type": "AggregateOffer",
            "priceCurrency": "USD",
            "lowPrice": product.min_price,
            "highPrice": product.max_price,
            "offerCount": product.pricing ? product.pricing.length : 1,
            "availability": "https://schema.org/InStock"
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "5.0",
            "reviewCount": pReviews.length > 0 ? pReviews.length : 1
        }
    };

    // --- Replace Placeholders ---
    let html = productTemplate;
    // Inject Header for Product Pages
    html = html.replace('{{HEADER}}', generateFullHeader('../../', products, categories, siteConfig));

    // SEO
    const seoTitle = `${product.title} – Verified & Fast | PvaitShop`;
    let seoDesc = product.meta_description || product.short_description || `Buy ${product.title} instantly.`;
    
    // Ensure Description Length (120-160 chars)
    if (seoDesc.length < 120) {
        seoDesc += " Get high-quality verified accounts instantly at PvaitShop. Secure, fast, and reliable service with 24/7 support.";
    }
    if (seoDesc.length > 160) {
        seoDesc = seoDesc.substring(0, 157) + "...";
    }

    html = html.replace(/{{SEO_TITLE}}/g, seoTitle);
    html = html.replace(/{{SEO_DESCRIPTION}}/g, seoDesc);
    html = html.replace('{{SEO_TAGS}}', `
        <link rel="canonical" href="${getDynamicUrl('product', slug)}" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="${seoTitle}" />
        <meta property="og:description" content="${seoDesc}" />
        <meta property="og:url" content="${getDynamicUrl('product', slug)}" />
        <meta property="og:type" content="product" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${seoTitle}" />
        <meta name="twitter:description" content="${seoDesc}" />
    `);
    html = html.replace('{{JSON_LD}}', `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);

    // Content
    const fullImgUrl = getImageUrl(product.image, '../../');
    const preloadHtml = fullImgUrl ? `<link rel="preload" href="${fullImgUrl}" as="image" fetchpriority="high">` : '';
    html = html.replace('{{PRODUCT_IMAGE_PRELOAD}}', preloadHtml);

    const productImageHtml = fullImgUrl 
        ? `<img src="${fullImgUrl}" alt="${product.image_title || product.title}" class="absolute inset-0 w-full h-full object-cover z-0" fetchpriority="high" width="800" height="600">`
        : '';
    html = html.replace('{{PRODUCT_IMAGE_HTML}}', productImageHtml);
    html = html.replace('{{PRODUCT_BG_CLASS}}', fullImgUrl ? 'hidden' : '');
    html = html.replace(/{{SOLID_COLOR}}/g, solidColor);
    html = html.replace(/rgb\(1,\s*2,\s*3\)/g, solidColor);
    html = html.replace('{{HERO_STARS}}', renderStars(5, "w-5 h-5"));
    
    // Category & Slug
    const catData = categories.find(c => c.name === product.category);
    const catSlug = catData ? catData.slug : product.category.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    html = html.replace(/{{CATEGORY}}/g, product.category);
    html = html.replace(/{{CATEGORY_SLUG}}/g, catSlug);
    
    html = html.replace(/{{PRODUCT_TITLE}}/g, product.title);
    html = html.replace(/{{DISPLAY_TITLE}}/g, product.display_title || product.title.replace(/^Buy\s+/i, ''));
    html = html.replace(/{{IMAGE_TITLE}}/g, product.image_title || product.title);
    html = html.replace('{{DETAIL_STARS}}', renderStars(5, "w-4 h-4"));
    html = html.replace('{{REVIEW_COUNT_TEXT}}', `(${pReviews.length} Customer Reviews)`);
    html = html.replace(/{{REVIEW_COUNT}}/g, String(pReviews.length));
    html = html.replace('{{PRICE_TEXT}}', `$${product.min_price.toFixed(2)} - $${product.max_price.toFixed(2)}`);
    html = html.replace(/{{SHORT_DESC}}/g, product.short_description || product.description || '');
    html = html.replace('{{FEATURES_LIST}}', featuresList);
    html = html.replace('{{PRICING_OPTIONS}}', pricingOptions);
    html = html.replace('{{LONG_DESC}}', generateRichDescription(product));
    html = html.replace('{{BOTTOM_FEATURES_LIST}}', bottomFeaturesList);
    html = html.replace('{{SUMMARY_STARS}}', renderStars(5, "w-5 h-5"));
    html = html.replace('{{REVIEWS_LIST}}', reviewsHtml);
    html = html.replace('{{RELATED_PRODUCTS}}', relatedHtml);
    html = html.replace('{{RELATED_ARTICLES}}', generateRelatedArticlesHtml(product, blogs));
    html = html.replace('{{SOCIAL_SHARE}}', generateSocialShare(product));
    
    // Inline Critical CSS
    html = html.replace(/{{CRITICAL_CSS}}/g, `<style>${productCssContent}</style>`);

    html = html.replace('{{FOOTER}}', generateFooter(products, siteConfig));

    html = html.replace('{{SITE_CONFIG_JS}}', ''); // Remove placeholder, siteConfig is in site_data.js

    // Global Placeholders (Must be after Footer to catch placeholders in it)
    html = replaceGlobalPlaceholders(html, siteConfig);

    // Write File
    const dir = path.join(paths.product, slug);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path.join(dir, 'index.html'), minifyHTML(html));
});
console.log("Product pages built.");

// --- 5. Generate Robots & Sitemap ---
console.log("Building Visual Sitemap Page...");
let sitemapHtmlContent = `
    <div class="max-w-7xl mx-auto px-4 py-12">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <!-- Main Pages -->
            <div class="bg-[#1E293B]/50 backdrop-blur-sm border border-white/5 rounded-2xl p-8 shadow-xl hover:border-cyan-500/30 transition-all group">
                <h2 class="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <div class="p-2 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                        <i data-lucide="home" class="w-6 h-6 text-cyan-400"></i>
                    </div>
                    Main Pages
                </h2>
                <div class="flex flex-col gap-4">
                    <a href="/" class="text-slate-400 hover:text-white transition-colors flex items-center gap-2 group/link">
                        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-600 group-hover/link:text-cyan-400 transition-colors"></i> 
                        <span class="font-medium">Home Page</span>
                    </a>
                    <a href="/${paths.blog}/" class="text-slate-400 hover:text-white transition-colors flex items-center gap-2 group/link">
                        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-600 group-hover/link:text-cyan-400 transition-colors"></i> 
                        <span class="font-medium">Our Blog</span>
                    </a>
                </div>
            </div>

            <!-- Categories -->
            <div class="bg-[#1E293B]/50 backdrop-blur-sm border border-white/5 rounded-2xl p-8 shadow-xl hover:border-cyan-500/30 transition-all group">
                <h2 class="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <div class="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                        <i data-lucide="layers" class="w-6 h-6 text-purple-400"></i>
                    </div>
                    Categories
                </h2>
                <div class="flex flex-col gap-4">
                    ${categories.map(cat => {
                        if (!cat.slug) return '';
                        const slug = cat.slug;
                        return `
                        <a href="/${paths.category}/${slug}/" class="text-slate-400 hover:text-white transition-colors flex items-center gap-2 group/link">
                            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-600 group-hover/link:text-purple-400 transition-colors"></i> 
                            <span class="font-medium">${cat.name}</span>
                        </a>`;
                    }).join('')}
                </div>
            </div>

            <!-- Blog Posts -->
            <div class="bg-[#1E293B]/50 backdrop-blur-sm border border-white/5 rounded-2xl p-8 shadow-xl hover:border-cyan-500/30 transition-all group">
                <h2 class="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <div class="p-2 bg-pink-500/10 rounded-lg group-hover:bg-pink-500/20 transition-colors">
                        <i data-lucide="book-open" class="w-6 h-6 text-pink-400"></i>
                    </div>
                    Blog Articles
                </h2>
                <div class="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                    ${blogs.map(post => `
                        <a href="/${paths.blog}/${post.slug}/" class="text-slate-400 hover:text-white transition-colors flex items-center gap-2 group/link">
                            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-600 group-hover/link:text-pink-400 transition-colors"></i> 
                            <span class="text-sm font-medium line-clamp-1">${post.title}</span>
                        </a>
                    `).join('')}
                </div>
            </div>

            <!-- Product Pages Grouped by Category -->
            ${categories.map(cat => {
                const catProducts = products.filter(p => p.category === cat.name);
                if (catProducts.length === 0) return '';
                const seed = getProductSeed({slug: cat.name});
                const hue = (seed * 137.508) % 360;
                const color = `hsl(${hue}, 70%, 60%)`;
                
                return `
                    <div class="bg-[#1E293B]/50 backdrop-blur-sm border border-white/5 rounded-2xl p-8 shadow-xl hover:border-cyan-500/30 transition-all group">
                        <h2 class="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                            <div class="p-2 rounded-lg group-hover:opacity-80 transition-opacity" style="background-color: ${color}20">
                                <i data-lucide="shopping-cart" class="w-6 h-6" style="color: ${color}"></i>
                            </div>
                            ${cat.name}
                        </h2>
                        <div class="flex flex-col gap-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                              ${catProducts.map(p => `
                                  <a href="/${paths.product}/${p.slug}/" class="text-slate-400 hover:text-white transition-colors flex items-center gap-2 group/link">
                                      <i data-lucide="chevron-right" class="w-4 h-4 text-slate-600 transition-colors"></i>
                                      <span class="text-sm font-medium line-clamp-1">${p.display_title || p.title}</span>
                                  </a>
                              `).join('')}
                          </div>
                    </div>
                `;
            }).join('')}
        </div>
    </div>
`;

let sitemapPageHtml = indexTemplate;
sitemapPageHtml = sitemapPageHtml.replace('{{HEADER}}', generateFullHeader('./', products, categories, siteConfig));
sitemapPageHtml = sitemapPageHtml.replace('{{HERO_TITLE}}', 'Site <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">Map</span>');
sitemapPageHtml = sitemapPageHtml.replace('{{HERO_SUBTITLE}}', 'Explore our complete directory of high-quality PVA accounts and digital services.');
sitemapPageHtml = sitemapPageHtml.replace('{{PRODUCT_IMAGE_PRELOAD}}', '');
sitemapPageHtml = sitemapPageHtml.replace('{{PRODUCT_GRID}}', sitemapHtmlContent);
sitemapPageHtml = sitemapPageHtml.replace('{{LATEST_ARTICLES}}', ''); // Clear latest articles section
sitemapPageHtml = sitemapPageHtml.replace('{{FOOTER}}', generateFooter(products, siteConfig));
sitemapPageHtml = sitemapPageHtml.replace(/{{CRITICAL_CSS}}/g, `<style>${cssContent}</style>`);
sitemapPageHtml = sitemapPageHtml.replace(/Exbsmmit – Buy Verified Accounts & Reviews Instantly/g, 'Sitemap | PvaitShop');

// Important: Replace all global placeholders in sitemap page too
sitemapPageHtml = replaceGlobalPlaceholders(sitemapPageHtml, siteConfig);

fs.writeFileSync('sitemap.html', minifyHTML(sitemapPageHtml));

sitemap += '  <url>\n';
sitemap += `    <loc>${getDynamicUrl('home')}sitemap.html</loc>\n`;
sitemap += '    <lastmod>' + new Date().toISOString().split('T')[0] + '</lastmod>\n';
sitemap += '    <priority>0.5</priority>\n';
sitemap += '  </url>\n';
sitemap += '</urlset>';
fs.writeFileSync('sitemap.xml', sitemap);
console.log("sitemap.xml and sitemap.html created.");

const robots = `User-agent: *
Allow: /
Sitemap: ${getDynamicUrl('home')}${paths.sitemap}`;
fs.writeFileSync('robots.txt', robots);
console.log("robots.txt created.");



console.log("Build Finished Successfully!");
