/**
 *  SemiNuevo - Main JavaScript
 *  Handles: Hero slider, Navbar, Catalog tabs, Rendering, Filters, Modal, 
 *  Stats counter, Scroll animations, Contact form
 */

// Global Constants
window.WHATSAPP_NUMBER = "584248700438"; // Default fallback

document.addEventListener('DOMContentLoaded', () => {
    // ===== SECURITY FIREWALL & IDS =====
    async function checkSecurity() {
        try {
            // 1. Get current IP
            let ip = 'Unknown';
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                const json = await res.json();
                ip = json.ip;
            } catch(e) {}

            // 2. Check Blacklist
            const { data: isBlocked } = await supabaseClient
                .from('ip_blacklist')
                .select('*')
                .eq('ip', ip)
                .maybeSingle();

            if (isBlocked) {
                document.body.innerHTML = `
                    <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#000; color:#fff; font-family:sans-serif; text-align:center; padding:20px;">
                        <i class="fas fa-shield-virus" style="font-size:4rem; color:#ff5252; margin-bottom:20px;"></i>
                        <h1 style="font-size:2rem; margin-bottom:10px;">ACCESO RESTRINGIDO</h1>
                        <p style="color:#888; max-width:500px;">Tu dirección IP (${ip}) ha sido bloqueada permanentemente por nuestro sistema de ciberseguridad debido a actividades sospechosas.</p>
                        <p style="font-size:0.8rem; margin-top:20px; color:#444;">Ref: FW-BLOCK-SYSTEM-01</p>
                    </div>
                `;
                return false;
            }

            // 3. Proactive Intrusion Detection (URL & Forms)
            const suspiciousPatterns = [
                /<script/i, /UNION SELECT/i, /OR '1'='1'/i, /DROP TABLE/i, /<img/i, /onerror/i
            ];
            
            const checkSuspicious = (str) => suspiciousPatterns.some(p => p.test(str));

            if (checkSuspicious(window.location.search) || checkSuspicious(window.location.hash)) {
                await supabaseClient.from('security_logs').insert([{
                    event_type: 'IDS_URL_ALERT',
                    severity: 'warning',
                    ip_address: ip,
                    details: `Patrón sospechoso detectado en la URL: ${window.location.href}`,
                    user_agent: navigator.userAgent
                }]);
            }

            return true;
        } catch (e) {
            console.warn('Security check failed:', e);
            return true;
        }
    }

    checkSecurity();

    function getVisitorId() {
        let vid = localStorage.getItem('sn_visitor_id');
        if (!vid) {
            vid = 'v-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('sn_visitor_id', vid);
        }
        return vid;
    }
    const visitorId = getVisitorId();

    function getSessionId() {
        let sid = sessionStorage.getItem('sn_session_id');
        if (!sid) {
            sid = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
            sessionStorage.setItem('sn_session_id', sid);
            sessionStorage.setItem('sn_is_new_session', 'true');
        }
        return sid;
    }
    const sessionId = getSessionId();

    async function logAnalyticsEvent(type, data = {}) {
        try {
            const enrichedData = {
                ...data,
                session_id: sessionId,
                userAgent: navigator.userAgent,
                language: navigator.language,
                screenRes: `${window.screen.width}x${window.screen.height}`,
                deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
                referrer: document.referrer || 'direct',
                intent_category: data.intent || detectIntent(data.section || window.location.pathname || 'home')
            };

            await supabaseClient.from('site_analytics').insert([{
                event_type: type,
                event_data: enrichedData,
                url: window.location.pathname,
                visitor_id: visitorId
            }]);
        } catch (e) {
            console.warn('Analytics error:', e);
        }
    }

    function detectIntent(key) {
        const k = String(key).toLowerCase();
        if (k.includes('calculadora') || k.includes('calc')) return 'Importación / Logística';
        if (k.includes('subasta') || k.includes('auction')) return 'Compra en Subasta';
        if (k.includes('catalogo') || k.includes('pedido') || k.includes('stock')) return 'Inventario Físico';
        if (k.includes('beneficio') || k.includes('taller') || k.includes('mastertech')) return 'Servicio / Postventa';
        if (k.includes('contacto') || k.includes('whatsapp')) return 'Conversión Directa';
        return 'Navegación General';
    }

    // Check if new session start
    if (sessionStorage.getItem('sn_is_new_session') === 'true') {
        sessionStorage.removeItem('sn_is_new_session');
        logAnalyticsEvent('session_start', { initial_page: window.location.pathname });
    }

    // Auto-track Section Interest
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                logAnalyticsEvent('section_view', { section: entry.target.id });
            }
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('section[id]:not(#inicio)').forEach(s => sectionObserver.observe(s));

    // Auto-track Scroll Depth
    let scrollMarkers = [25, 50, 75, 90];
    window.addEventListener('scroll', () => {
        const scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
        scrollMarkers = scrollMarkers.filter(marker => {
            if (scrollPercent >= marker) {
                logAnalyticsEvent('scroll_depth', { depth: marker + '%' });
                return false;
            }
            return true;
        });
    }, { passive: true });

    // Page view event
    logAnalyticsEvent('page_view', { referrer: document.referrer });

    // ===== HERO SLIDER =====
    const heroSlider = {
        slides: document.querySelectorAll('.hero-slide'),
        dotsContainer: document.getElementById('heroDots'),
        prevBtn: document.getElementById('heroPrev'),
        nextBtn: document.getElementById('heroNext'),
        currentIndex: 0,
        interval: null,
        delay: 5000,

        init() {
            if (!this.slides.length) return;
            this.createDots();
            this.startAutoplay();
            this.prevBtn?.addEventListener('click', () => this.prev());
            this.nextBtn?.addEventListener('click', () => this.next());
        },

        createDots() {
            if (!this.dotsContainer) return;
            this.slides.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.classList.add('hero-dot');
                if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', () => this.goTo(i));
                this.dotsContainer.appendChild(dot);
            });
        },

        goTo(index) {
            this.slides[this.currentIndex].classList.remove('active');
            this.dotsContainer.children[this.currentIndex]?.classList.remove('active');
            this.currentIndex = index;
            this.slides[this.currentIndex].classList.add('active');
            this.dotsContainer.children[this.currentIndex]?.classList.add('active');
            this.resetAutoplay();
        },

        next() {
            const nextIndex = (this.currentIndex + 1) % this.slides.length;
            this.goTo(nextIndex);
        },

        prev() {
            const prevIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
            this.goTo(prevIndex);
        },

        startAutoplay() {
            this.interval = setInterval(() => this.next(), this.delay);
        },

        resetAutoplay() {
            clearInterval(this.interval);
            this.startAutoplay();
        }
    };

    heroSlider.init();

    // ===== NAVBAR SCROLL =====
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    // Set active link based on current page
    const currentPath = window.location.pathname.split('/').pop().replace('.html', '');
    navLinks.forEach(link => {
        link.classList.remove('active');
        const rawHref = link.getAttribute('href') || '';
        const href = rawHref.split('#')[0].replace('.html', '');
        
        const isHomePage = !currentPath || currentPath === 'index' || currentPath === '';
        
        if (href === currentPath || (isHomePage && (href === '/' || href === 'index' || href === '' || href === '#inicio'))) {
            link.classList.add('active');
        }
    });

    window.addEventListener('scroll', () => {
        // Navbar background
        if (window.scrollY > 60) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // ===== MOBILE MENU =====
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');

    navToggle?.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('open');
        document.body.style.overflow = navMenu.classList.contains('open') ? 'hidden' : '';
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navToggle?.classList.remove('active');
            navMenu?.classList.remove('open');
            document.body.style.overflow = '';
        });
    });

    // ===== CATALOG MAIN TABS (3 tabs) =====
    const mainTabs = document.querySelectorAll('.catalog-main-tab');
    const seminuevosPanel = document.getElementById('seminuevos-panel');
    const porpedidoPanel = document.getElementById('porpedido-panel');
    const zerokmPanel = document.getElementById('zerokm-panel');
    const allPanels = [seminuevosPanel, porpedidoPanel, zerokmPanel];

    mainTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            mainTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            allPanels.forEach(p => p && p.classList.remove('active'));
            const section = tab.dataset.section;
            if (section === 'seminuevos') seminuevosPanel?.classList.add('active');
            else if (section === 'porpedido') porpedidoPanel?.classList.add('active');
            else if (section === '0km') zerokmPanel?.classList.add('active');
            observeAnimations();

            // === RESTAURAR SCROLL SUAVE AL PANEL ===
            const targetId = section === '0km' ? 'zerokm-panel' : `${section}-panel`;
            const target = document.getElementById(targetId);
            const navbar = document.getElementById('navbar');
            if (target && navbar) {
                const navHeight = navbar.offsetHeight;
                const targetPos = target.offsetTop - navHeight - 20;
                window.scrollTo({ top: targetPos, behavior: 'smooth' });
            }
        });
    });

    function showGridLoading(grid) {
        if (!grid) return;
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;"><div class="loader-spinner"></div><p style="color: var(--outline); margin-top: 15px;">Conectando con el inventario...</p></div>`;
    }

    // ===== RENDER VEHICLES =====
    const seminuevosGrid = document.getElementById('seminuevosGrid');
    const porpedidoGrid = document.getElementById('porpedidoGrid');
    const zerokmGrid = document.getElementById('zerokmGrid');

    // Sort helper
    function parsePrice(priceStr) {
        if (!priceStr || priceStr === 'Consultar') return Infinity;
        return parseFloat(priceStr.replace(/[^0-9.]/g, '')) || Infinity;
    }

    function sortVehicles(arr) {
        const sortSelect = document.getElementById('catalogSort');
        const sortVal = sortSelect ? sortSelect.value : 'default';
        if (sortVal === 'default') return arr;
        const sorted = [...arr];
        switch (sortVal) {
            case 'price_asc': return sorted.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
            case 'price_desc': return sorted.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
            case 'year_desc': return sorted.sort((a, b) => b.year - a.year);
            case 'year_asc': return sorted.sort((a, b) => a.year - b.year);
            default: return sorted;
        }
    }

    function renderVehicles(dataSource, gridElement, typeConditionFilter = 'todos', brandFilter = 'todos') {
        if (!gridElement) return;
        let filtered = dataSource;

        // Search Filter
        const searchTerm = document.getElementById('catalogSearch')?.value?.toLowerCase() || '';
        if (searchTerm) {
            filtered = filtered.filter(v =>
                (v.title || '').toLowerCase().includes(searchTerm) ||
                (v.year || '').toString().includes(searchTerm) ||
                ((v.bodyType || v.body_type) && (v.bodyType || v.body_type).toLowerCase().includes(searchTerm))
            );
        }

        if (typeConditionFilter !== 'todos') {
            filtered = filtered.filter(v => {
                const bt = (v.bodyType || v.body_type || '').toLowerCase();
                return v.condition === typeConditionFilter || (bt && bt === typeConditionFilter.toLowerCase());
            });
        }
        if (brandFilter !== 'todos') {
            filtered = filtered.filter(v => (v.title || '').toLowerCase().includes(brandFilter));
        }
        filtered = sortVehicles(filtered);
        gridElement.innerHTML = '';
        if (filtered.length === 0) {
            gridElement.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;"><i class="fas fa-car" style="font-size: 3rem; color: var(--outline); margin-bottom: 20px; display: block;"></i><p style="font-size: 1.2rem; color: var(--on-surface-variant);">No hay vehículos en esta categoría aún.</p><p style="color: var(--outline); margin-top: 8px;">Escríbenos por WhatsApp para consultar disponibilidad.</p></div>`;
            return;
        }
        filtered.forEach((car, index) => {
            const card = document.createElement('div');
            card.className = 'vehicle-card';
            card.dataset.id = car.id;
            card.style.cursor = 'pointer';
            card.style.transitionDelay = `${index * 0.08}s`;
            
            // SEO Optimized Alt Text: [Marca] [Modelo] [Año] - Seminuevos Venezuela
            const optimizedAlt = `${car.title} ${car.year} - Seminuevos Venezuela`;
            
            const priceDisplay = car.price === 'Consultar' ? `<span class="price-consult">Consultar Precio</span>` : car.price;
            const originText = car.origin === 'nacional' ? 'Nacional' : (car.badge || 'Puerto Libre');
            const originClass = car.origin === 'nacional' ? 'nacional' : 'importado';
            const originIcon = car.origin === 'nacional' ? 'fa-flag' : 'fa-globe';
            const singleBadge = `<span class="origin-badge ${originClass}"><i class="fas ${originIcon}"></i> ${originText}</span>`;
            const viewCount = car.views || 0;
            const viewsBadge = viewCount > 0 ? `<span class="views-badge" id="views-card-${car.id}"><i class="fas fa-eye"></i> ${viewCount} vista${viewCount !== 1 ? 's' : ''}</span>` : `<span class="views-badge" id="views-card-${car.id}" style="display:none;"></span>`;
            let carImg = (car.images && car.images.length > 0 && car.images[0]) ? car.images[0] : '';
            const fallbackImg = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=70&w=500&auto=format&fit=crop';
            if (!carImg) {
                carImg = fallbackImg;
            }
            
            const loadingAttr = index < 4 ? 'eager' : 'lazy';
            const priorityAttr = index < 4 ? 'fetchpriority="high"' : '';

            card.innerHTML = `
                <div class="vehicle-card-image">
                    <img src="${carImg}" alt="${optimizedAlt}" loading="${loadingAttr}" ${priorityAttr} decoding="async" onerror="this.onerror=null; this.src='${fallbackImg}';">
                    ${car.mastertech ? `<img src="CERTIFICADO---MASTERTECH.png" alt="Sello Mastertech" class="mastertech-seal">` : ''}
                    ${viewsBadge}
                </div>
                <div class="vehicle-card-body">
                    <div class="vehicle-card-tags">
                        ${singleBadge}
                    </div>
                    <h3 class="vehicle-card-title">${car.title}</h3>
                    <p class="vehicle-card-price">${priceDisplay}</p>
                    <div class="vehicle-card-specs">
                        <span class="spec-item"><i class="fas fa-calendar"></i> ${car.year}</span>
                        <span class="spec-item"><i class="fas fa-road"></i> ${car.km}</span>
                        <span class="spec-item"><i class="fas fa-gas-pump"></i> ${car.fuel}</span>
                        <span class="spec-item"><i class="fas fa-gears"></i> ${car.transmission}</span>
                    </div>
                </div>
            `;
            gridElement.appendChild(card);
        });
        
        // Generate dynamic JSON-LD for the current rendered list
        updateProductSchema(filtered);
        observeAnimations();
    }

    function updateProductSchema(vehicles) {
        let schemaContainer = document.getElementById('dynamic-product-schema');
        if (!schemaContainer) {
            schemaContainer = document.createElement('script');
            schemaContainer.id = 'dynamic-product-schema';
            schemaContainer.type = 'application/ld+json';
            document.head.appendChild(schemaContainer);
        }

        const productSchemas = vehicles.map(v => {
            const cleanDesc = v.description ? v.description.split('\n\n[ADMIN-LINK]:')[0] : `Vehículo ${v.title} año ${v.year} disponible en Seminuevos Venezuela.`;
            return {
                "@context": "https://schema.org/",
                "@type": "Product",
                "name": v.title,
                "image": (v.images && v.images[0]) || '',
                "description": cleanDesc,
                "brand": {
                    "@type": "Brand",
                    "name": (v.title || '').split(' ')[0]
                },
                "model": v.title,
                "productionDate": (v.year || '').toString(),
                "offers": {
                    "@type": "Offer",
                    "url": window.location.href,
                    "priceCurrency": "USD",
                    "price": v.price === 'Consultar' ? "0" : (v.price || '').replace(/[^0-9.-]+/g, ""),
                    "availability": "https://schema.org/InStock",
                    "itemCondition": v.condition === '0km' ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition"
                }
            };
        });

        schemaContainer.text = JSON.stringify(productSchemas);
    }

    // Sort and Search listeners
    const catalogSort = document.getElementById('catalogSort');
    const catalogSearch = document.getElementById('catalogSearch');

    function renderAllWithSearch() {
        const query = catalogSearch?.value || '';
        renderVehicles(sortVehicles(appVehiclesSeminuevos, catalogSort?.value), seminuevosGrid, query);
        renderVehicles(sortVehicles(appVehiclesPorPedido, catalogSort?.value), porpedidoGrid, query);
        renderVehicles(sortVehicles(appVehicles0km, catalogSort?.value), zerokmGrid, query);
    }

    catalogSort?.addEventListener('change', renderAllWithSearch);
    catalogSearch?.addEventListener('input', renderAllWithSearch);

    let appVehiclesSeminuevos = [];
    let appVehiclesPorPedido = [];
    let appVehicles0km = [];

    function renderAllPanels() {
        renderVehicles(appVehiclesSeminuevos, seminuevosGrid, filtersState.seminuevos.type, filtersState.seminuevos.brand);
        renderVehicles(appVehiclesPorPedido, porpedidoGrid, filtersState.porpedido.type, filtersState.porpedido.brand);
        renderVehicles(appVehicles0km, zerokmGrid, filtersState.zerokm.type, filtersState.zerokm.brand);

        // Featured grid population
        const featuredGrid = document.getElementById('featuredVehiclesGrid');
        if (featuredGrid) {
            let allVehicles = [...appVehiclesSeminuevos, ...appVehicles0km, ...appVehiclesPorPedido];
            // Sort by views descending to show the most popular cars
            allVehicles.sort((a, b) => (b.views || 0) - (a.views || 0));
            renderVehicles(allVehicles.slice(0, 3), featuredGrid, 'todos', 'todos');
        }
    }

    // ===== FILTER STATE =====
    const filtersState = {
        seminuevos: { type: 'todos', brand: 'todos' },
        porpedido: { type: 'todos', brand: 'todos' },
        zerokm: { type: 'todos', brand: 'todos' }
    };

    function setupFilters(containerId, brandSelectId, stateKey, gridEl, getDataSource) {
        const container = document.getElementById(containerId);
        const brandSelect = document.getElementById(brandSelectId);
        
        // Function to render buttons dynamically
        window[`refreshFilters_${stateKey}`] = () => {
            const vehicles = getDataSource();
            if (!container) return;
            
            // Get unique body types present in these vehicles
            const uniqueTypes = [...new Set(vehicles.map(v => v.bodyType || v.body_type).filter(Boolean))];
            
            // Define the most common ones to show even if empty, or just show what exists
            // To satisfy user, we show what exists + the standard ones if we want
            const typesToShow = ['todos', ...uniqueTypes];
            
            container.innerHTML = typesToShow.map(t => {
                const label = t === 'todos' ? 'Todos' : (BODY_TYPE_LABELS[t.toLowerCase()] || t);
                const isActive = filtersState[stateKey].type === t;
                return `<button class="filter-btn ${isActive ? 'active' : ''}" data-filter="${t}">${label}</button>`;
            }).join('');
            
            // Re-attach click events
            container.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    filtersState[stateKey].type = btn.dataset.filter;
                    renderVehicles(getDataSource(), gridEl, filtersState[stateKey].type, filtersState[stateKey].brand);
                });
            });
        };

        brandSelect?.addEventListener('change', (e) => {
            filtersState[stateKey].brand = e.target.value;
            renderVehicles(getDataSource(), gridEl, filtersState[stateKey].type, filtersState[stateKey].brand);
        });
    }

    setupFilters('seminuevosFilters', 'seminuevosBrandFilter', 'seminuevos', seminuevosGrid, () => appVehiclesSeminuevos);
    setupFilters('porpedidoFilters', 'porpedidoBrandFilter', 'porpedido', porpedidoGrid, () => appVehiclesPorPedido);
    setupFilters('zerokmFilters', 'zerokmBrandFilter', 'zerokm', zerokmGrid, () => appVehicles0km);

    // ===== SUPABASE DATA FETCH =====
    async function initSupabaseData() {
        if (window.location.pathname.includes('vehiculo')) {
            return; // Skip full catalog query on single vehicle detail page for maximum speed
        }
        try {
            // Load vehicles and site_settings concurrently in PARALLEL (Zero 404 console errors)
            const [vDataRes, sDataRes] = await Promise.all([
                supabaseClient.from('vehicles').select('*').eq('status', 'active'),
                supabaseClient.from('site_settings').select('*')
            ]);

            const allStatic = (typeof vehiclesSeminuevos !== 'undefined') ? vehiclesSeminuevos : [];
            
            // Helper Discriminator: Strict detection of imported / auction / por_pedido vehicles
            const isImportedOrAuction = (v) => {
                if (!v) return false;
                const c = (v.catalog || '').toLowerCase().trim();
                const avail = (v.availability || '').toLowerCase().trim();
                const orig = (v.origin || '').toLowerCase().trim();
                const desc = (v.description || '').toLowerCase();
                const title = (v.title || '').toLowerCase();

                if (c === 'importados' || c === 'importado' || c === 'por_pedido' || c === 'pedido' || c === 'subasta' || c === 'subastas') return true;
                if (avail === 'por_pedido' || orig === 'importado') return true;
                if (v.lot_number || v.lotNumber || v.smi_id || (v.id && String(v.id).startsWith('SMI-'))) return true;
                if (desc.includes('subasta') || desc.includes('yarda usa') || desc.includes('copart') || desc.includes('iaai') || desc.includes('por pedido') || desc.includes('importación') || desc.includes('importacion')) return true;
                if (title.includes('actual') || title.includes('exceeds mechanical limits') || title.includes('smi-')) return true;
                return false;
            };

            const staticSemi = allStatic.filter(v => {
                if (isImportedOrAuction(v)) return false;
                const c = (v.catalog || '').toLowerCase().trim();
                return c === 'seminuevos' || c === 'stock_local' || v.availability === 'entrega_inmediata' || v.origin === 'nacional';
            });

            const staticPorPedido = allStatic.filter(v => {
                if (isImportedOrAuction(v)) return true;
                const c = (v.catalog || '').toLowerCase().trim();
                return c === 'importados' || c === 'importado' || c === 'por_pedido' || c === 'pedido' || c === 'subasta' || c === 'subastas';
            });

            const staticZeroKm = allStatic.filter(v => {
                const c = (v.catalog || '').toLowerCase().trim();
                return c === '0km' || v.condition === '0km';
            });

            let localVehs = [];
            try { localVehs = JSON.parse(localStorage.getItem('sn_vehicles') || '[]'); } catch(e) {}
            const combinedRaw = [...(vDataRes.data || []), ...localVehs];

            const dbSemi = combinedRaw.filter(v => {
                if (isImportedOrAuction(v)) return false; // Strictly exclude imported/auction vehicles from Stock Local
                const c = (v.catalog || '').toLowerCase().trim();
                if (c === 'seminuevos' || c === 'seminuevo' || c === 'stock_local') return true;
                return v.availability === 'entrega_inmediata' || v.origin === 'nacional';
            });

            const dbPorPedido = combinedRaw.filter(v => {
                if (isImportedOrAuction(v)) return true; // Strictly route imported/auction vehicles to Por Pedido
                const c = (v.catalog || '').toLowerCase().trim();
                if (c === 'importados' || c === 'importado' || c === 'por_pedido' || c === 'pedido' || c === 'subasta' || c === 'subastas') return true;
                if (v.availability === 'por_pedido' || v.origin === 'importado') return true;
                const desc = (v.description || '').toLowerCase();
                if (desc.includes('subasta') || desc.includes('lote') || desc.includes('vin:')) return true;
                return false;
            });

            const db0km = combinedRaw.filter(v => {
                const c = (v.catalog || '').toLowerCase().trim();
                if (c === '0km') return true;
                return v.condition === '0km';
            });

            let deleted = [];
            try { deleted = JSON.parse(localStorage.getItem('sn_deleted_vehicles') || '[]'); } catch(e) {}

            // Combine DB & Static vehicles without duplicating DB vehicles against each other
            const mergeByTitle = (dbArr, staticArr) => {
                const list = [...dbArr]; // Include ALL database vehicles
                const dbTitles = new Set(dbArr.map(item => (item.title || '').toLowerCase().trim()));
                const dbIds = new Set(dbArr.map(item => String(item.id || '')));

                staticArr.forEach(item => {
                    const titleKey = (item.title || '').toLowerCase().trim();
                    const idKey = String(item.id || '');
                    if (titleKey && !deleted.includes(titleKey) && !deleted.includes(idKey) && !dbTitles.has(titleKey) && !dbIds.has(idKey)) {
                        list.push(item);
                    }
                });
                return list;
            };

            appVehiclesSeminuevos = mergeByTitle(dbSemi, staticSemi);
            appVehiclesPorPedido = mergeByTitle(dbPorPedido, staticPorPedido);
            appVehicles0km = mergeByTitle(db0km, staticZeroKm);

            // Render all grids with data
            renderAllPanels();

            // Load settings
            const sData = sDataRes.data;
            const map = {};
            if (sData) {
                sData.forEach(s => {
                    try {
                        map[s.key] = JSON.parse(s.value);
                    } catch (e) {
                        map[s.key] = s.value;
                    }
                });
                
                // Render Promotions from site_settings or fallback (after map is populated)
                if (map.promotions_list) {
                    let pList = map.promotions_list;
                    if (typeof pList === 'string') {
                        try { pList = JSON.parse(pList); } catch(e) {}
                    }
                    if (Array.isArray(pList) && pList.length > 0) {
                        const activeList = pList.filter(p => p.status === 'active');
                        renderPromotions(activeList.length > 0 ? activeList : getActivePromotionsFromStorageOrFallback());
                    } else {
                        renderPromotions(getActivePromotionsFromStorageOrFallback());
                    }
                } else {
                    renderPromotions(getActivePromotionsFromStorageOrFallback());
                }

                if (map.whatsapp_number) {
                    // Normalize number (remove +, spaces, etc.) for WhatsApp links
                    window.WHATSAPP_NUMBER = String(map.whatsapp_number).replace(/[^0-9]/g, '');
                }

                // Update UI visually
                if (map.company_name) document.querySelectorAll('.logo-text').forEach(el => el.textContent = map.company_name);

                const fFb = document.querySelector('a[title="Facebook"]');
                const fIg = document.querySelector('a[title="Instagram"]');
                const fTt = document.querySelector('a[title="TikTok"]');
                const fYt = document.querySelector('a[title="YouTube"]');

                if (map.social_facebook && fFb) fFb.href = map.social_facebook;
                if (map.social_instagram && fIg) fIg.href = map.social_instagram;
                if (map.social_tiktok && fTt) fTt.href = map.social_tiktok;
                if (map.social_youtube && fYt) fYt.href = map.social_youtube;
                // Load Calculator rates
                window.CALC_FLETE = map.calc_flete || 3500;
                window.CALC_ADUANA = map.calc_aduana || 3500;
                window.CALC_DOC_VZLA = map.calc_doc_vzla || 1000;
                window.CALC_SERVICE_FEE = map.calc_service_fee || 900;

                // Load Hero Slides
                const overrideSlides = [
                    {
                        image: 'images/gallery/honda-hrv-2024-sport/1.jpg',
                        tag: 'OFERTA EXCLUSIVA',
                        title: 'Honda HR-V 2024 Sport',
                        originalPrice: 33000,
                        discountPercentage: 9900,
                        financingBonus: 10000,
                        finalPrice: 13100,
                        waText: 'Hola, quiero asegurar la Honda HR-V 2024 Sport con la oferta de financiamiento.',
                        ctaPrimary: 'Asegurar Oferta',
                        ctaSecondary: 'Ver Detalles'
                    },
                    {
                        image: 'images/gallery/toyota-corolla-cross-le-4x4-awd-2022/1.jpg',
                        tag: 'ACCIÓN RÁPIDA',
                        title: 'Toyota Corolla Cross LE 2022',
                        originalPrice: 31990,
                        discountPercentage: 9597,
                        financingBonus: 10000,
                        finalPrice: 12393,
                        waText: 'Hola, quiero aplicar al financiamiento en la Corolla Cross LE 2022.',
                        ctaPrimary: 'Aplicar Ahora',
                        ctaSecondary: 'Más Info'
                    },
                    {
                        image: 'images/gallery/toyota-4runner-2021-sr5/1.jpg',
                        tag: 'ESTATUS INMEDIATO',
                        title: 'Toyota 4Runner 2021 SR5',
                        originalPrice: 39990,
                        discountPercentage: 11997,
                        financingBonus: 10000,
                        finalPrice: 17993,
                        waText: 'Hola, quiero apartar la Toyota 4Runner 2021 con el beneficio especial.',
                        ctaPrimary: 'Reservar Ya',
                        ctaSecondary: 'Inventario'
                    }
                ];

                if (map.hero_slides && map.hero_slides.length > 0) {
                    renderDynamicHero(map.hero_slides);
                } else {
                    renderDynamicHero(overrideSlides);
                }
            }
        } catch (e) { console.error('Error fetching CMS data', e); }

        renderAllPanels();

        // Refresh filter buttons after data is loaded
        if (typeof refreshFilters_seminuevos === 'function') refreshFilters_seminuevos();
        if (typeof refreshFilters_porpedido === 'function') refreshFilters_porpedido();
        if (typeof refreshFilters_zerokm === 'function') refreshFilters_zerokm();
    }

    function renderDynamicHero(slidesData) {
        const slider = document.querySelector('.hero-slider');
        const dotsContainer = document.getElementById('heroDots');
        if (!slider) return;

        let html = '';
        slidesData.forEach((s, i) => {
            const isFirst = i === 0;
            const isSecond = i === 1;

            let subtitleHtml = s.subtitle || '';
            if (s.originalPrice) {
                const fmt = (num) => Number(num).toLocaleString('en-US');
                let rows = '';
                rows += `<div style='display: flex; justify-content: space-between; color: var(--on-surface-variant); text-decoration: line-through; margin-bottom: 8px; font-size: 0.95rem;'><span>Precio de Lista</span><span>$${fmt(s.originalPrice)}</span></div>`;
                if (s.discountPercentage && Number(s.discountPercentage) > 0) {
                    rows += `<div style='display: flex; justify-content: space-between; color: #ffb4ab; margin-bottom: 8px; font-size: 0.95rem; opacity: 0; animation: contentReveal 0.6s ease 0.9s forwards;'><span>Descuento Especial</span><span>-$${fmt(s.discountPercentage)}</span></div>`;
                }
                if (s.financingBonus && Number(s.financingBonus) > 0) {
                    rows += `<div style='display: flex; justify-content: space-between; color: #bfcdff; margin-bottom: 12px; font-size: 0.95rem; opacity: 0; animation: contentReveal 0.6s ease 1.2s forwards;'><span>Financiamiento</span><span>-$${fmt(s.financingBonus)}</span></div>`;
                }
                rows += `<div style='border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; display: flex; justify-content: space-between; font-size: 1.4rem; font-weight: 700; opacity: 0; animation: contentReveal 0.6s ease 1.5s forwards;'><span>Llévala por</span><span class='text-accent'>$${fmt(s.finalPrice || 0)}</span></div>`;
                subtitleHtml = `<div style='background: rgba(10,10,10,0.55); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--ghost-border-gold); backdrop-filter: blur(15px); width: 100%; max-width: 400px; text-align: left; margin: 0 auto;'>${rows}</div>`;
            } else if (s.subtitle && !s.subtitle.includes('<div')) {
                subtitleHtml = `<p>${s.subtitle}</p>`;
            }

            // Re-crear el diseño premium exacto
            html += `
                <div class="hero-slide ${i === 0 ? 'active' : ''}" style="background-image: url('${s.image}')">
                    <div class="hero-overlay" style="background: ${isFirst ? 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 30%, transparent 100%)' : 'linear-gradient(to top, rgba(10,10,10,1) 0%, transparent 20%), linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)'};"></div>
                        <div class="hero-content">
                            <div class="hero-tag" style="opacity: 0; animation: contentReveal 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.2s forwards;">
                                <i class="fas ${isFirst ? 'fa-bolt' : (isSecond ? 'fa-star' : 'fa-car')}" style="color: var(--primary);"></i> ${s.tag}
                            </div>
                            <h1 class="hero-title" style="opacity: 0; animation: contentReveal 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.4s forwards;">
                                ${s.title.includes('<span') ? s.title : s.title.replace('0KM', '<span class="text-accent">0KM</span>')}
                            </h1>
                            <div class="hero-subtitle" style="opacity: 0; animation: contentReveal 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.6s forwards;">
                                ${subtitleHtml}
                            </div><div class="hero-buttons" style="opacity: 0; animation: contentReveal 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.8s forwards;">
                                <a href="https://wa.me/${window.WHATSAPP_NUMBER}?text=${encodeURIComponent(s.waText || 'Hola, quiero aprovechar la oferta VIP del sitio web.')}" class="btn btn-primary" target="_blank" style="text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">
                                   ${s.ctaPrimary || 'Reclamar Oferta'} <i class="fas fa-arrow-right" style="margin-left: 8px;"></i>
                                </a>
                                <a href="#catalogo" class="btn btn-outline" style="text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">
                                   ${s.ctaSecondary || 'Ver Inventario'}
                                </a>
                            </div>
                        </div>
                    </div>
            `;
        });

        // Mantener las flechas de control
        const controls = slider.querySelector('.hero-controls');
        slider.innerHTML = html;
        if (controls) slider.appendChild(controls);

        // Re-iniciar el objeto heroSlider para que use los nuevos slides
        setTimeout(() => {
            heroSlider.slides = document.querySelectorAll('.hero-slide');
            heroSlider.currentIndex = 0;
            // Re-crear dots si es necesario
            if (dotsContainer) {
                dotsContainer.innerHTML = '';
                heroSlider.slides.forEach((_, i) => {
                    const dot = document.createElement('div');
                    dot.classList.add('hero-dot');
                    if (i === 0) dot.classList.add('active');
                    dot.addEventListener('click', () => heroSlider.goTo(i));
                    dotsContainer.appendChild(dot);
                });
            }
            // Asegurar que el primer slide sea visible inmediatamente
            if(heroSlider.slides.length > 0) {
                heroSlider.slides[0].classList.add('active');
            }
        }, 150);
    }

    const defaultPromotions = [
        {
            id: 'default-1',
            title: 'Toyota 4Runner 2021 SR5',
            subtitle: '2021 · $38,990 · Motor 4.0L V6',
            description: 'Vehículo en excelentes condiciones. Financiamiento exclusivo disponible en Margarita.',
            badge_text: 'OFERTA DESTACADA',
            discount_text: '$2,000 OFF',
            cta_text: 'Ver Oferta',
            cta_url: '/catalogo',
            image_url: 'images/gallery/toyota-4runner-2021-sr5/1.jpg',
            bg_color: '#275CEA',
            is_featured: true,
            status: 'active'
        },
        {
            id: 'default-2',
            title: 'Honda HR-V 2024 Sport',
            subtitle: '2024 · $23,100 · 0 KM',
            description: 'Trae tu vehículo importado directamente con entrega en 45 días y garantía MasterTech.',
            badge_text: 'ENTREGA RÁPIDA',
            discount_text: 'Bono $1,000',
            cta_text: 'Cotizar Ahora',
            cta_url: '#contacto',
            image_url: 'images/gallery/honda-hrv-2024-sport/1.jpg',
            bg_color: '#1a45b8',
            is_featured: false,
            status: 'active'
        },
        {
            id: 'default-3',
            title: 'Revisión Técnica MasterTech',
            subtitle: 'Soporte y Garantía Oficial',
            description: 'Revisión completa de 50 puntos para asegurar tu vehículo seminuevo.',
            badge_text: 'SERVICIO GRATIS',
            discount_text: 'Valor: $150',
            cta_text: 'Agendar Cita',
            cta_url: '#contacto',
            image_url: 'CERTIFICADO---MASTERTECH.png',
            bg_color: '#0f3a9e',
            is_featured: false,
            status: 'active'
        }
    ];

    function getActivePromotionsFromStorageOrFallback() {
        try {
            const raw = localStorage.getItem('sn_promotions');
            if (raw) {
                const parsed = JSON.parse(raw);
                const active = parsed.filter(p => p.status === 'active');
                if (active.length > 0) return active;
            }
        } catch(e) {}

        const allActiveVehicles = [...appVehiclesSeminuevos, ...appVehicles0km, ...appVehiclesPorPedido];
        if (allActiveVehicles && allActiveVehicles.length > 0) {
            const top = allActiveVehicles.slice(0, 3);
            return top.map((v, i) => ({
                id: 'auto-promo-' + (v.id || i),
                title: v.title,
                subtitle: `${v.year || 2024} · ${v.price || 'Consultar'} · Motor ${v.engine || 'V6'}`,
                description: v.description ? (v.description.substring(0, 120) + '...') : `Vehículo ${v.title} disponible con entrega en Venezuela.`,
                badge_text: v.badge || 'OFERTA ESPECIAL',
                discount_text: v.price || '$2,000 OFF',
                cta_text: 'Ver Vehículo',
                cta_url: `vehiculo.html?id=${v.id}`,
                image_url: (v.images && v.images.length > 0) ? v.images[0] : (v.image || ''),
                bg_color: i === 0 ? '#275CEA' : (i === 1 ? '#1a45b8' : '#0f3a9e'),
                is_featured: i === 0,
                status: 'active'
            }));
        }

        return defaultPromotions;
    }

    function updatePromotionsHeader() {
        const tagEl = document.querySelector('.promotions-section .section-tag');
        const titleEl = document.querySelector('.promotions-section .section-title');
        const subEl = document.querySelector('.promotions-section .section-subtitle');

        const customTag = localStorage.getItem('sn_promo_tag') || (window.SITE_SETTINGS && window.SITE_SETTINGS.promo_tag);
        const customTitle = localStorage.getItem('sn_promo_title') || (window.SITE_SETTINGS && window.SITE_SETTINGS.promo_title);
        const customSubtitle = localStorage.getItem('sn_promo_subtitle') || (window.SITE_SETTINGS && window.SITE_SETTINGS.promo_subtitle);

        if (customTag && tagEl) {
            tagEl.innerHTML = `<i class="fas fa-tags"></i> ${customTag}`;
        }
        if (customTitle && titleEl) {
            const parts = customTitle.trim().split(' ');
            if (parts.length > 1) {
                const last = parts.pop();
                titleEl.innerHTML = `${parts.join(' ')} <span class="text-accent">${last}</span>`;
            } else {
                titleEl.textContent = customTitle;
            }
        }
        if (customSubtitle && subEl) {
            subEl.textContent = customSubtitle;
        }
    }

    // ===== PROMOTIONS RENDERER =====
    function renderPromotions(promos) {
        updatePromotionsHeader();
        const grid = document.getElementById('promotionsGrid');
        if (!grid) return;

        if (!promos || promos.length === 0) {
            promos = getActivePromotionsFromStorageOrFallback();
        }

        grid.innerHTML = promos.map((p, idx) => {
            const color = p.bg_color || '#275CEA';
            const isFeatured = p.is_featured && idx === 0;
            const ctaHref = p.cta_url || '#contacto';
            const isWhatsApp = ctaHref.startsWith('wa.me') || ctaHref.includes('whatsapp');
            const ctaLink = isWhatsApp
                ? `https://wa.me/${window.WHATSAPP_NUMBER}?text=${encodeURIComponent(p.cta_url || 'Hola, quiero información sobre esta promoción.')}`
                : ctaHref;

            // Expiry badge
            let expiresBadge = '';
            if (p.expires_at) {
                const daysLeft = Math.ceil((new Date(p.expires_at) - Date.now()) / 86400000);
                if (daysLeft > 0 && daysLeft <= 30) {
                    expiresBadge = `<div class="promo-expires"><span class="blink"></span>VENCE EN ${daysLeft} DÍA${daysLeft !== 1 ? 'S' : ''}</div>`;
                }
            }

            // Image or gradient placeholder
            const imageHtml = p.image_url
                ? `<div class="promo-card-image">
                        <img src="${p.image_url}" alt="${p.title}" loading="lazy">
                        ${p.badge_text ? `<div class="promo-badge" style="background:${color};">${p.badge_text}</div>` : ''}
                        ${p.discount_text ? `<div class="promo-discount">${p.discount_text}</div>` : ''}
                        ${expiresBadge}
                   </div>`
                : `<div class="promo-card-image-placeholder" style="--promo-color:${color}; ${isFeatured ? 'min-height:240px;' : 'height:185px;'}">
                        <i class="fas fa-tags"></i>
                        ${p.badge_text ? `<div class="promo-badge" style="background:${color}; position:absolute; top:14px; left:14px;">${p.badge_text}</div>` : ''}
                        ${p.discount_text ? `<div class="promo-discount">${p.discount_text}</div>` : ''}
                        ${expiresBadge}
                   </div>`;

            return `
            <article class="promo-card${isFeatured ? ' featured' : ''}" style="--promo-color:${color};" role="article">
                <div class="promo-card-accent"></div>
                ${imageHtml}
                <div class="promo-card-body">
                    ${p.subtitle ? `<div class="promo-card-subtitle">${p.subtitle}</div>` : ''}
                    <h3 class="promo-card-title">${p.title}</h3>
                    ${p.description ? `<p class="promo-card-desc">${p.description}</p>` : ''}
                    <a href="${ctaLink}" class="promo-card-cta" ${isWhatsApp ? 'target="_blank"' : ''}>
                        ${isWhatsApp ? '<i class="fab fa-whatsapp"></i>' : '<i class="fas fa-arrow-right"></i>'}
                        ${p.cta_text || 'Ver Oferta'}
                    </a>
                </div>
            </article>`;
        }).join('');
    }

    initSupabaseData();

    // ===== VEHICLE MODAL =====
    const modal = document.getElementById('vehicleModal');
    const modalClose = document.getElementById('modalClose');

    // Gallery slider state
    const modalGallery = {
        images: [],
        currentIndex: 0,

        init(images) {
            this.images = images || [];
            this.currentIndex = 0;
            this.render();
        },

        render() {
            const slider = document.getElementById('modalSlider');
            const dots = document.getElementById('modalDots');
            const counter = document.getElementById('modalCounter');

            // Build images
            slider.innerHTML = this.images.map((src, i) =>
                `<img src="${src}" alt="Foto ${i + 1}" class="${i === 0 ? 'active' : ''}" loading="lazy">`
            ).join('');

            // Build dots (max 15 visible)
            const maxDots = Math.min(this.images.length, 15);
            dots.innerHTML = Array.from({ length: maxDots }, (_, i) =>
                `<div class="modal-gallery-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`
            ).join('');

            // Counter
            counter.textContent = `1 / ${this.images.length}`;

            // Dot clicks
            dots.querySelectorAll('.modal-gallery-dot').forEach(dot => {
                dot.addEventListener('click', () => this.goTo(parseInt(dot.dataset.index)));
            });
        },

        goTo(index) {
            if (index < 0) index = this.images.length - 1;
            if (index >= this.images.length) index = 0;

            const slider = document.getElementById('modalSlider');
            const dots = document.getElementById('modalDots');
            const counter = document.getElementById('modalCounter');

            // Update images
            slider.querySelectorAll('img').forEach((img, i) => {
                img.classList.toggle('active', i === index);
            });

            // Update dots
            const maxDots = Math.min(this.images.length, 15);
            if (index < maxDots) {
                dots.querySelectorAll('.modal-gallery-dot').forEach((dot, i) => {
                    dot.classList.toggle('active', i === index);
                });
            }

            // Update counter
            counter.textContent = `${index + 1} / ${this.images.length}`;
            this.currentIndex = index;
        },

        next() { this.goTo(this.currentIndex + 1); },
        prev() { this.goTo(this.currentIndex - 1); }
    };

    // Gallery arrow clicks
    document.getElementById('modalPrev')?.addEventListener('click', () => modalGallery.prev());
    document.getElementById('modalNext')?.addEventListener('click', () => modalGallery.next());

    async function openModal(carIdStr) {
        const carId = String(carIdStr);
        window.location.href = `vehiculo?id=${carId}`;
    }

    function closeModal() {
        if (!modal) return;
        if (modal.classList.contains('active') && currentVehicleId) {
            const duration = Math.round((performance.now() - modalStartTime) / 1000);
            if (duration > 1) {
                logAnalyticsEvent('time_spent', {
                    vehicle_id: currentVehicleId,
                    title: currentVehicleTitle,
                    duration_seconds: duration
                });
            }
        }
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentVehicleId = null;
    }

    modalClose?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if (modal?.classList.contains('active')) {
            if (e.key === 'ArrowLeft') modalGallery.prev();
            if (e.key === 'ArrowRight') modalGallery.next();
        }
    });

    document.addEventListener('click', (e) => {
        const waBtn = e.target.closest('.track-whatsapp');
        if (waBtn) {
            logAnalyticsEvent('whatsapp_click', { vehicle: waBtn.dataset.title });
        }

        const viewBtn = e.target.closest('.view-details');
        const vehicleCard = e.target.closest('.vehicle-card');

        if (viewBtn) {
            e.preventDefault();
            openModal(viewBtn.dataset.id);
        } else if (vehicleCard && !e.target.closest('a') && !e.target.closest('button')) {
            const carId = vehicleCard.dataset.id;
            if (carId) {
                openModal(carId);
            }
        }

        // Info Modal links
        const infoBtn = e.target.closest('.open-info-modal');
        if (infoBtn) {
            e.preventDefault();
            openInfoModal(infoBtn.dataset.info);
        }
    });

    // ===== INFO MODAL LOGIC =====
    const infoModal = document.getElementById('infoModal');
    const infoModalClose = document.getElementById('infoModalClose');

    const infoContent = {
        mastertech: {
            title: 'Soporte Técnico MasterTech',
            icon: '<i class="fas fa-wrench"></i>',
            body: 'MasterTech es nuestro centro de servicio especializado y aliado estratégico. Contamos con tecnología de diagnóstico de última generación, técnicos certificados y un amplio stock de repuestos para garantizar que tu vehículo importado reciba el mejor cuidado posible. Desde mantenimientos preventivos hasta reparaciones complejas, MasterTech es el respaldo que tu inversión merece.',
            cta: 'Consultar Servicio',
            wa: 'Hola%2C%20quiero%20consultar%20sobre%20el%20Soporte%20T%C3%A9cnico%20MasterTech'
        },
        mtwash: {
            title: 'MT Wash Detailing',
            icon: '<i class="fas fa-droplet"></i>',
            body: 'MT Wash ofrece servicios de estética automotriz premium. Utilizamos productos de alta gama y técnicas de detallado profesional para proteger la pintura de tu vehículo, limpiar profundamente el interior y mantener ese brillo de salón por mucho más tiempo. Es el complemento ideal para que tu SemiNuevo luzca siempre como el primer día.',
            cta: 'Agendar Lavado',
            wa: 'Hola%2C%20quiero%20agendar%20un%20servicio%20de%20MT%20Wash%20Detailing'
        },
        lealtad: {
            title: 'Programa de Lealtad',
            icon: '<i class="fas fa-star"></i>',
            body: 'Al adquirir tu vehículo con Seminuevos Agency, automáticamente formas parte de nuestro Programa de Lealtad. Genera puntos en cada visita y servicio en MasterTech y obtén descuentos directos en repuestos, mano de obra y accesorios. Mientras más cuidas tu vehículo con nosotros, más ahorra tu bolsillo. Úntete hoy y empieza a disfrutar tus beneficios.',
            cta: 'Unirse al Programa',
            wa: 'Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20el%20Programa%20de%20Lealtad%20de%20Seminuevos%20Agency'
        }
    };

    function openInfoModal(type) {
        const content = infoContent[type];
        if (!content) return;

        document.getElementById('infoModalIcon').innerHTML = content.icon;
        document.getElementById('infoModalTitle').textContent = content.title;
        document.getElementById('infoModalBody').textContent = content.body;
        const ctaEl = document.getElementById('infoModalCta');
        ctaEl.innerHTML = `<i class="fab fa-whatsapp"></i> ${content.cta}`;
        ctaEl.href = `https://wa.me/584248700438?text=${content.wa || 'Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n'}`;
        ctaEl.target = '_blank';

        infoModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeInfoModal() {
        infoModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    infoModalClose?.addEventListener('click', closeInfoModal);
    infoModal?.addEventListener('click', (e) => {
        if (e.target === infoModal) closeInfoModal();
    });

    // ===== STATS COUNTER =====
    const statNumbers = document.querySelectorAll('.stat-number');
    let statsAnimated = false;

    function animateStats() {
        if (statsAnimated) return;
        statsAnimated = true;

        statNumbers.forEach(el => {
            const target = parseInt(el.dataset.target);
            const duration = 2000;
            const start = performance.now();

            function update(now) {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out quad
                const eased = 1 - (1 - progress) * (1 - progress);
                el.textContent = Math.floor(eased * target);
                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    el.textContent = target;
                }
            }

            requestAnimationFrame(update);
        });
    }

    // ===== SCROLL ANIMATIONS =====
    function observeAnimations() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
        );

        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            observer.observe(el);
        });
    }

    // Add animations to static elements
    document.querySelectorAll('.service-card, .testimonial-card, .stat-item, .value-item').forEach(el => {
        el.classList.add('animate-on-scroll');
    });

    observeAnimations();

    // Stats animation on scroll
    const statsSection = document.querySelector('.stats-bar');
    if (statsSection) {
        const statsObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        animateStats();
                        statsObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.5 }
        );
        statsObserver.observe(statsSection);
    }

    // ===== CONTACT FORM =====
    const contactForm = document.getElementById('contactForm');
    contactForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        if (!submitBtn) return;
        const originalText = submitBtn.innerHTML;

        const name = document.getElementById('formName').value;
        const phone = document.getElementById('formPhone').value;
        const email = document.getElementById('formEmail').value;
        const service = document.getElementById('formService').value;
        const message = document.getElementById('formMessage').value;

        // 1. Save to Supabase (Async background)
        const formData = {
            name, phone, email, service,
            message: message || 'Interesado en ' + service,
            status: 'new',
            visitor_id: visitorId
        };

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

            // Attempt to save to DB but don't block WhatsApp if it's slow
            const { error } = await supabaseClient.from('inquiries').insert([formData]);
            if (error) console.warn("Supabase insert error:", error);

            // 2. Open WhatsApp
            const waMessage = `¡Hola! Soy *${name}*.\n\n` +
                `📧 Email: ${email}\n` +
                `📱 Teléfono: ${phone}\n` +
                `🔧 Servicio: ${service}\n\n` +
                `💬 Mensaje: ${message || 'Sin mensaje adicional'}`;

            const waUrl = `https://wa.me/${window.WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;
            window.open(waUrl, '_blank');

            alert('¡Gracias! Hemos recibido tu mensaje y te estamos redirigiendo a WhatsApp.');
            contactForm.reset();
        } catch (err) {
            console.error('Error in contact flow:', err);
            // Fallback to pure WhatsApp
            window.open(`https://wa.me/${window.WHATSAPP_NUMBER}?text=${encodeURIComponent(name + " - Consulta")}`, '_blank');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    // ===== SMOOTH SCROLL ENHANCEMENT =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            // Skip links inside modals, card footers, or non-section anchors
            if (this.closest('.vehicle-card-footer') || this.closest('.modal') || this.classList.contains('view-details')) return;
            const targetId = this.getAttribute('href');
            if (!targetId || targetId === '#' || targetId.length < 2) return;
            // Validate it's a proper CSS ID selector
            try {
                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    const navHeight = navbar.offsetHeight;
                    const targetPos = target.offsetTop - navHeight - 20;
                    window.scrollTo({
                        top: targetPos,
                        behavior: 'smooth'
                    });
                }
            } catch (err) {
                // Invalid selector, let the browser handle it normally
            }
        });
    });

    // ===== COST CALCULATOR (Puerto Libre / Nacional) =====
    const calcStatus = document.getElementById('calcStatus');
    const calcFieldsPL = document.getElementById('calcFieldsPL');
    const calcNacionalNotice = document.getElementById('calcNacionalNotice');
    const calcResults = document.getElementById('calcResults');

    const toggleAuctionFees = document.getElementById('toggleAuctionFees');
    if (toggleAuctionFees) {
        toggleAuctionFees.addEventListener('click', () => {
            const details = document.getElementById('auctionFeesDetails');
            const icon = toggleAuctionFees.querySelector('i');
            if (details.style.display === 'none') {
                details.style.display = 'block';
                if (icon) icon.style.transform = 'rotate(180deg)';
            } else {
                details.style.display = 'none';
                if (icon) icon.style.transform = 'rotate(0deg)';
            }
        });
    }

    calcStatus?.addEventListener('change', () => {
        if (calcStatus.value === 'nacional') {
            calcFieldsPL.style.display = 'none';
            calcNacionalNotice.style.display = 'flex';
            calcResults.style.display = 'none';
        } else {
            calcFieldsPL.style.display = 'block';
            calcNacionalNotice.style.display = 'none';
            calcResults.style.display = 'block';
        }
        updateCalc();
    });

    const calcOrigin = document.getElementById('calcOrigin');
    const calcDestination = document.getElementById('calcDestination');
    const customTransportGroup = document.getElementById('customTransportGroup');
    const calcCustomTransport = document.getElementById('calcCustomTransport');

    calcOrigin?.addEventListener('change', () => {
        if (calcOrigin.value === 'custom') {
            customTransportGroup.style.display = 'block';
        } else {
            customTransportGroup.style.display = 'none';
        }
        updateCalc();
    });

    calcDestination?.addEventListener('change', updateCalc);
    calcCustomTransport?.addEventListener('input', updateCalc);

    function updateCalc() {
        const val = document.getElementById('calcBaseCost').value;
        const baseCost = parseFloat(val) || 0;
        const fmt = (v) => {
            const rounded = Math.round(v || 0);
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0
            }).format(rounded);
        };

        const status = calcStatus.value; // Using the persistent reference
        const isPL = (status === 'puerto_libre');
        const isEEUU = (status === 'eeuu');

        // Show detailed fees (auction related) for both PL and EEUU
        document.querySelectorAll('.detailed-fee').forEach(row => {
            row.style.display = (isPL || isEEUU) ? 'flex' : 'none';
        });

        // Show VZLA-specific fees ONLY for Puerto Libre
        document.querySelectorAll('.vzla-fee-row').forEach(row => {
            row.style.display = isPL ? 'flex' : 'none';
        });

        // If no cost entered, reset labels but keep rows visible if needed
        if (baseCost <= 0) {
            const resetIds = [
                'resBase', 'resTotalAuctionFees', 'resBuyFee', 'resInternetFee', 'resAuctionServiceFee',
                'resEnvFee', 'resTitleFee', 'resStateTax', 'resBrokerFee',
                'resServiceFee', 'resTraslado', 'resFlete', 'resAduana',
                'resDocVzla', 'resRepuesto', 'resTotal'
            ];
            resetIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '$0';
            });
            if (document.getElementById('resTotalMax')) {
                document.getElementById('resTotalMax').textContent = '$0';
            }
            return;
        }

        // === CALCULATION LOGIC ===
        const buyFee = baseCost * 0.10;

        // Auction fees apply to both PL and EEUU
        const internetFee = 160;
        const auctionServiceFee = 95;
        const envFee = 15;
        const titleFee = 20;
        const stateTax = baseCost * 0.07;
        const brokerFee = 500;
        const serviceFee = window.CALC_SERVICE_FEE || 900;

        const stateCoords = {
            AL: [32.8066, -86.7911], AK: [61.3707, -152.4044], AZ: [33.7297, -111.4312], AR: [34.9697, -92.3731],
            CA: [36.1162, -119.6815], CO: [39.0598, -105.3111], CT: [41.5977, -72.7553], DE: [39.3185, -75.5071],
            FL: [27.7662, -81.6867], GA: [33.0406, -83.6430], HI: [21.0943, -157.4983], ID: [44.2404, -114.4788],
            IL: [40.3494, -88.9861], IN: [39.8494, -86.2582], IA: [42.0115, -93.2105], KS: [38.5266, -96.7264],
            KY: [37.6681, -84.6700], LA: [31.1695, -91.8678], ME: [44.6939, -69.3819], MD: [39.0639, -76.8021],
            MA: [42.2301, -71.5301], MI: [43.3266, -84.5360], MN: [45.6944, -93.9001], MS: [32.7416, -89.6786],
            MO: [38.4560, -92.2883], MT: [46.9219, -110.4543], NE: [41.1253, -98.2680], NV: [38.3135, -117.0553],
            NH: [43.4524, -71.5638], NJ: [40.2989, -74.5210], NM: [34.8405, -106.2484], NY: [42.1657, -74.9480],
            NC: [35.6300, -79.8064], ND: [47.5289, -99.7840], OH: [40.3887, -82.7649], OK: [35.5653, -96.9289],
            OR: [44.5720, -122.0709], PA: [40.5907, -77.2097], RI: [41.6808, -71.5117], SC: [33.8568, -80.9450],
            SD: [44.2997, -99.4388], TN: [35.7478, -86.6923], TX: [31.0544, -97.5634], UT: [40.1500, -111.8624],
            VT: [44.0458, -72.7106], VA: [37.7693, -78.1699], WA: [47.4009, -121.4904], WV: [38.4912, -80.9544],
            WI: [44.2685, -89.6165], WY: [42.7559, -107.3024]
        };

        function getDist(stateA, stateB) {
            if (!stateCoords[stateA] || !stateCoords[stateB]) return 0;
            if (stateA === stateB && stateA === 'FL') return 450;
            if (stateA === stateB) return 250; // Local charge for other states
            
            const [lat1, lon1] = stateCoords[stateA];
            const [lat2, lon2] = stateCoords[stateB];
            const R = 3958.8; // Radius of Earth in miles
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const miles = R * c;
            // Applying a 1.25 factor to convert straight-line distance to approximate driving distance
            return Math.round(miles * 1.25);
        }

        let costTraslado = 0;
        if (calcOrigin.value === 'custom') {
            costTraslado = parseFloat(calcCustomTransport.value) || 0;
        } else {
            const origin = calcOrigin.value;
            const dest = calcDestination.value;
            const distMiles = getDist(origin, dest);
            costTraslado = distMiles * 1; // $1 por milla
            
            // Re-apply the Florida special case
            if (origin === 'FL' && dest === 'FL') costTraslado = 450;
        }

        // Venezuela Factors (ONLY for Puerto Libre)
        // Ensure they are exactly 0 if NOT isPL
        const flete = isPL ? (window.CALC_FLETE || 3500) : 0;
        const aduana = isPL ? (window.CALC_ADUANA || 3500) : 0;
        const docVzla = isPL ? (window.CALC_DOC_VZLA || 1000) : 0;

        const includeRepairs1 = document.getElementById('calcRepairs1').checked;
        const includeRepairs2 = document.getElementById('calcRepairs2').checked;
        const repuesto = (includeRepairs1 ? baseCost * 0.20 : 0) + (includeRepairs2 ? baseCost * 0.30 : 0);

        const total = baseCost + buyFee + internetFee + auctionServiceFee + envFee +
            titleFee + stateTax + brokerFee + serviceFee +
            costTraslado + repuesto + flete + aduana + docVzla;
        const totalMax = total * 1.10;

        // UI Updates
        document.getElementById('resBase').textContent = fmt(baseCost);
        
        const totalAuctionFees = buyFee + internetFee + auctionServiceFee + envFee + titleFee + stateTax;
        if (document.getElementById('resTotalAuctionFees')) {
            document.getElementById('resTotalAuctionFees').textContent = fmt(totalAuctionFees);
        }
        
        const elBuyFee = document.getElementById('resBuyFee'); if (elBuyFee) elBuyFee.textContent = fmt(buyFee);
        const elInternetFee = document.getElementById('resInternetFee'); if (elInternetFee) elInternetFee.textContent = fmt(internetFee);
        const elAuctionService = document.getElementById('resAuctionServiceFee'); if (elAuctionService) elAuctionService.textContent = fmt(auctionServiceFee);
        const elEnvFee = document.getElementById('resEnvFee'); if (elEnvFee) elEnvFee.textContent = fmt(envFee);
        const elTitleFee = document.getElementById('resTitleFee'); if (elTitleFee) elTitleFee.textContent = fmt(titleFee);
        const elStateTax = document.getElementById('resStateTax'); if (elStateTax) elStateTax.textContent = fmt(stateTax);
        const elBrokerFee = document.getElementById('resBrokerFee'); if (elBrokerFee) elBrokerFee.textContent = fmt(brokerFee);
        const elServiceFee = document.getElementById('resServiceFee'); if (elServiceFee) elServiceFee.textContent = fmt(serviceFee);
        document.getElementById('resTraslado').textContent = fmt(costTraslado);
        document.getElementById('resFlete').textContent = fmt(flete);
        document.getElementById('resAduana').textContent = fmt(aduana);
        document.getElementById('resDocVzla').textContent = fmt(docVzla);
        document.getElementById('resRepuesto').textContent = fmt(repuesto);
        document.getElementById('resTotal').textContent = fmt(total);
        if (document.getElementById('resTotalMax')) {
            document.getElementById('resTotalMax').textContent = fmt(totalMax);
        }
    }
    window.updateCalculatorLogic = updateCalc; // Expose globally

    const btnCalculateCost = document.getElementById('btnCalculateCost');
    btnCalculateCost?.addEventListener('click', updateCalc);

    const btnDownloadQuote = document.getElementById('btnDownloadQuote');
    btnDownloadQuote?.addEventListener('click', () => {
        const baseCost = document.getElementById('calcBaseCost').value;
        if (!baseCost || baseCost <= 0) {
            alert('Por favor calcula una cotización primero.');
            return;
        }
        document.body.classList.add('print-mode-quote');
        window.print();
    });

    const btnDownloadSheet = document.getElementById('modalDownloadSheet');
    btnDownloadSheet?.addEventListener('click', () => {
        const car = window.currentCarForPrint;
        if (!car) return;
        
        const fallbackBodyType = typeof BODY_TYPE_LABELS !== 'undefined' && BODY_TYPE_LABELS[car.bodyType] ? BODY_TYPE_LABELS[car.bodyType] : car.bodyType || 'Vehículo';
        const fallbackOrigin = typeof ORIGIN_LABELS !== 'undefined' && ORIGIN_LABELS[car.origin] ? ORIGIN_LABELS[car.origin] : car.origin || 'N/A';
        
        const sheetContent = document.getElementById('printSheetContent');
        if (sheetContent) {
            // Usa solo la primera foto
            const firstImg = (car.images && car.images.length > 0) ? car.images[0] : '';
            sheetContent.innerHTML = `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                
                    <!-- Image & Hero Section -->
                    <div style="display: flex; gap: 25px; margin-bottom: 30px;">
                        
                        <!-- Left Column: Photo -->
                        <div style="flex: 1.2;">
                            ${firstImg ? `<img src="${firstImg}" style="width: 100%; height: 280px; object-fit: cover; border-radius: 12px; border: 1px solid #eaeaea;" alt="${car.title}">` : `<div style="width:100%; height:280px; background:#f5f5f5; display:flex; align-items:center; justify-content:center; color:#999; border-radius: 12px; border: 1px solid #eaeaea;">Sin imagen</div>`}
                        </div>

                        <!-- Right Column: Title & Price -->
                        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                            <div style="display: inline-block; padding: 4px 10px; background: #eef2ff; color: #275cea; font-size: 0.75rem; font-weight: bold; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; width: fit-content; border: 1px solid #c7d2fe;">
                                ${car.condition === '0km' ? '0KM' : 'Seminuevo'}
                            </div>
                            <h3 style="margin: 0 0 10px 0; font-size: 1.8rem; color: #111; line-height: 1.2;">${car.title}</h3>
                            <p style="margin: 0 0 20px 0; font-size: 1.5rem; font-weight: 800; color: #275cea;">
                                ${car.price === 'Consultar' ? 'Consultar Precio' : car.price}
                            </p>
                            
                            <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #275cea; border-top: 1px solid #eaeaea; border-right: 1px solid #eaeaea; border-bottom: 1px solid #eaeaea;">
                                <p style="margin: 0; font-size: 0.85rem; color: #555; line-height: 1.6;">
                                    <strong>Disponibilidad:</strong> ${car.availability === 'entrega_inmediata' ? 'Entrega Inmediata' : 'Por Pedido'}<br>
                                    <strong>Estatus Legal:</strong> ${fallbackOrigin}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Specifications Grid -->
                    <div style="margin-bottom: 30px;">
                        <h4 style="margin: 0 0 15px 0; font-size: 1.1rem; color: #111; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                            Especificaciones Técnicas
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                            
                            <div style="padding: 12px; border: 1px solid #eaeaea; border-radius: 8px; background: #fff;">
                                <div style="font-size: 0.7rem; color: #888; text-transform: uppercase; margin-bottom: 4px;">Año</div>
                                <div style="font-size: 1rem; font-weight: 600; color: #111;">${car.year}</div>
                            </div>
                            
                            <div style="padding: 12px; border: 1px solid #eaeaea; border-radius: 8px; background: #fff;">
                                <div style="font-size: 0.7rem; color: #888; text-transform: uppercase; margin-bottom: 4px;">Kilometraje</div>
                                <div style="font-size: 1rem; font-weight: 600; color: #111;">${car.km}</div>
                            </div>
                            
                            <div style="padding: 12px; border: 1px solid #eaeaea; border-radius: 8px; background: #fff;">
                                <div style="font-size: 0.7rem; color: #888; text-transform: uppercase; margin-bottom: 4px;">Motor</div>
                                <div style="font-size: 1rem; font-weight: 600; color: #111;">${car.engine}</div>
                            </div>
                            
                            <div style="padding: 12px; border: 1px solid #eaeaea; border-radius: 8px; background: #fff;">
                                <div style="font-size: 0.7rem; color: #888; text-transform: uppercase; margin-bottom: 4px;">Transmisión</div>
                                <div style="font-size: 1rem; font-weight: 600; color: #111;">${car.transmission}</div>
                            </div>
                            
                            <div style="padding: 12px; border: 1px solid #eaeaea; border-radius: 8px; background: #fff;">
                                <div style="font-size: 0.7rem; color: #888; text-transform: uppercase; margin-bottom: 4px;">Combustible</div>
                                <div style="font-size: 1rem; font-weight: 600; color: #111;">${car.fuel}</div>
                            </div>
                            
                            <div style="padding: 12px; border: 1px solid #eaeaea; border-radius: 8px; background: #fff;">
                                <div style="font-size: 0.7rem; color: #888; text-transform: uppercase; margin-bottom: 4px;">Tipo de Carrocería</div>
                                <div style="font-size: 1rem; font-weight: 600; color: #111;">${fallbackBodyType}</div>
                            </div>
                            
                        </div>
                    </div>

                    <!-- Description -->
                    ${car.description ? `
                    <div>
                        <h4 style="margin: 0 0 15px 0; font-size: 1.1rem; color: #111; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                            Descripción del Vehículo
                        </h4>
                        <div style="padding: 20px; background: #fcfcfc; border: 1px solid #eaeaea; border-radius: 8px;">
                            <p style="margin: 0; white-space: pre-line; line-height: 1.6; font-size: 0.95rem; color: #444;">${car.description}</p>
                        </div>
                    </div>
                    ` : ''}

                </div>
            `;
        }
        
        document.body.classList.add('print-mode-sheet');
        window.print();
    });

    window.addEventListener('afterprint', () => {
        document.body.classList.remove('print-mode-quote', 'print-mode-sheet');
    });

    ['calcRepairs1', 'calcRepairs2'].forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        const updatePillState = () => {
            const label = input.closest('.repair-pill-item');
            if (label) {
                if (input.checked) {
                    label.classList.add('checked');
                } else {
                    label.classList.remove('checked');
                }
            }
            if (typeof updateCalc === 'function') updateCalc();
        };

        input.addEventListener('change', updatePillState);
        input.addEventListener('click', updatePillState);
        updatePillState();
    });
    document.getElementById('calcBaseCost')?.addEventListener('input', updateCalc);
    document.getElementById('calcOrigin')?.addEventListener('change', updateCalc);
    document.getElementById('calcDestination')?.addEventListener('change', updateCalc);

    // ===== TESTIMONIALS CAROUSEL =====
    const testimonialTrack = document.getElementById('testimonialTrack');
    const testimonialPrev = document.getElementById('testimonialPrev');
    const testimonialNext = document.getElementById('testimonialNext');
    const testimonialDots = document.getElementById('testimonialDots');

    if (testimonialTrack) {
        const slides = testimonialTrack.querySelectorAll('.carousel-slide');
        let currentSlide = 0;
        let autoplayInterval;

        // Create dots
        slides.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.classList.add('carousel-dot');
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(i));
            testimonialDots.appendChild(dot);
        });

        function goToSlide(index) {
            currentSlide = index;
            testimonialTrack.style.transform = `translateX(-${index * 100}%)`;
            testimonialDots.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === index));
        }

        testimonialPrev?.addEventListener('click', () => {
            goToSlide((currentSlide - 1 + slides.length) % slides.length);
            resetAutoplay();
        });
        testimonialNext?.addEventListener('click', () => {
            goToSlide((currentSlide + 1) % slides.length);
            resetAutoplay();
        });

        function startAutoplay() { autoplayInterval = setInterval(() => goToSlide((currentSlide + 1) % slides.length), 5000); }
        function resetAutoplay() { clearInterval(autoplayInterval); startAutoplay(); }
        startAutoplay();
    }

    // ===== PARALLAX EFFECT ON HERO =====
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        const heroContent = document.querySelectorAll('.hero-content');
        heroContent.forEach(content => {
            content.style.transform = `translateY(${scrolled * 0.15}px)`;
            content.style.opacity = 1 - scrolled / 800;
        });
    });



    // ===== AUCTION PUSH FORM =====
    const btnSubmitBid = document.getElementById('btnSubmitBid');
    if (btnSubmitBid) {
        btnSubmitBid.addEventListener('click', () => {
            const link = document.getElementById('auctionLink').value;
            const maxBid = document.getElementById('auctionMaxBid').value;

            if (!link) {
                alert('Por favor inserta el enlace o VIN del lote para continuar.');
                return;
            }

            const message = `Hola, quiero participar en una subasta.%0A%0A*Lote/VIN:* ${link}%0A*Mi puja máxima estimada es:* $${maxBid ? maxBid : 'A discutir con el equipo'}%0A%0A¿Cuáles son los siguientes pasos para gestionar el depósito y habilitar la puja real?`;
            window.open(`https://wa.me/${window.WHATSAPP_NUMBER}?text=${message}`, '_blank');
        });
    }

    // ===== SEARCH LISTENER =====
    // Uses the existing listener defined earlier in the script
    if (catalogSearch) {
        catalogSearch.addEventListener('input', () => {
            if (typeof renderAllPanels === 'function') renderAllPanels();
        });
    }

    // ===== SHARE LOGIC =====
    document.addEventListener('click', (e) => {
        const shareBtn = e.target.closest('.share-vehicle');
        if (shareBtn) {
            e.preventDefault();
            const id = shareBtn.getAttribute('data-id');
            const url = `${window.location.origin}${window.location.pathname}?v=${id}`;

            navigator.clipboard.writeText(url).then(() => {
                alert('¡Enlace de vehículo copiado al portapapeles!');
            }).catch(err => {
                const dummy = document.createElement('input');
                document.body.appendChild(dummy);
                dummy.value = url;
                dummy.select();
                document.execCommand('copy');
                document.body.removeChild(dummy);
                alert('¡Enlace de vehículo copiado!');
            });
        }
    });

    // ===== DEEP LINKING =====
    const urlParams = new URLSearchParams(window.location.search);
    const vId = urlParams.get('v');
    if (vId) {
        setTimeout(() => {
            if (typeof openModal === 'function') openModal(vId);
            document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
        }, 2000);
    }

    window.openVehicleModal = function (id) {
        if (typeof openModal === 'function') openModal(id);
    };
});

// ===== 0KM HERO VEHICLE INFO MODAL =====
window.openVehicleInfoModal = function (vehicleKey) {
    const overlay = document.getElementById('vehicleInfoModal');
    if (overlay) {
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
};

window.closeVehicleInfoModal = function () {
    const overlay = document.getElementById('vehicleInfoModal');
    if (overlay) {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }
};

// Escape key for vehicle info modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('vehicleInfoModal');
        if (overlay && overlay.classList.contains('open')) {
            window.closeVehicleInfoModal();
        }
    }
});


// Función para copiar el enlace directo al Yaris GR
function copyYarisLink() {
    const url = window.location.origin + window.location.pathname + '#yaris-gr-exclusive';
    
    navigator.clipboard.writeText(url).then(() => {
        const msg = document.getElementById('copyMessage');
        msg.style.display = 'block';
        
        // Ocultar el mensaje después de 3 segundos
        setTimeout(() => {
            msg.style.display = 'none';
        }, 3000);
    }).catch(err => {
        console.error('Error al copiar el enlace: ', err);
    });
}
