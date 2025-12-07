/**
 * AED Empire Theme JavaScript
 */

(function() {
  'use strict';

  // =========================================
  // MOBILE MENU
  // =========================================
  const mobileMenu = {
    init() {
      const toggle = document.querySelector('[data-menu-toggle]');
      const close = document.querySelector('[data-menu-close]');
      const menu = document.querySelector('[data-mobile-menu]');
      const overlay = document.querySelector('[data-menu-overlay]');

      if (!toggle || !menu) return;

      toggle.addEventListener('click', () => this.open(menu, overlay));
      close?.addEventListener('click', () => this.close(menu, overlay));
      overlay?.addEventListener('click', () => this.close(menu, overlay));

      // Accordions
      menu.querySelectorAll('.mobile-menu__accordion-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
          const content = trigger.nextElementSibling;
          content.classList.toggle('is-open');
          trigger.querySelector('svg').style.transform = content.classList.contains('is-open') ? 'rotate(180deg)' : '';
        });
      });
    },
    open(menu, overlay) {
      menu.classList.add('is-open');
      overlay?.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    },
    close(menu, overlay) {
      menu.classList.remove('is-open');
      overlay?.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  // =========================================
  // MEGA MENU (Desktop hover handled via CSS)
  // =========================================

  // =========================================
  // PREDICTIVE SEARCH
  // =========================================
  const predictiveSearch = {
    init() {
      const toggle = document.querySelector('[data-search-toggle]');
      const close = document.querySelector('[data-search-close]');
      const container = document.querySelector('[data-predictive-search]');
      const input = document.querySelector('[data-search-input]');
      const results = document.querySelector('[data-search-results]');

      if (!toggle || !container) return;

      toggle.addEventListener('click', () => {
        container.hidden = false;
        setTimeout(() => input?.focus(), 100);
      });

      close?.addEventListener('click', () => {
        container.hidden = true;
        input.value = '';
        results.innerHTML = '';
      });

      let debounce;
      input?.addEventListener('input', (e) => {
        clearTimeout(debounce);
        const query = e.target.value.trim();
        if (query.length < 2) {
          results.innerHTML = '';
          return;
        }
        debounce = setTimeout(() => this.search(query, results), 300);
      });

      // Close on escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !container.hidden) {
          container.hidden = true;
        }
      });
    },
    async search(query, results) {
      try {
        const response = await fetch(`/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product,collection,page&resources[limit]=6`);
        const data = await response.json();
        this.render(data, results, query);
      } catch (e) {
        console.error('Search error:', e);
      }
    },
    render(data, results, query) {
      const products = data.resources?.results?.products || [];
      let html = '';

      if (products.length) {
        html += '<div class="predictive-search__products">';
        products.forEach(p => {
          html += `
            <a href="${p.url}" class="predictive-search__product">
              <img src="${p.image || ''}" alt="${p.title}" width="80" height="80" loading="lazy">
              <div>
                <span class="predictive-search__product-title">${p.title}</span>
                <span class="predictive-search__product-price">${this.formatMoney(p.price)}</span>
              </div>
            </a>`;
        });
        html += '</div>';
      }

      if (!html) {
        html = `<p style="text-align:center;color:var(--color-text-light);padding:20px">No results for "${query}"</p>`;
      }

      html += `<a href="/search?q=${encodeURIComponent(query)}" class="btn btn--outline" style="display:block;text-align:center;margin-top:20px">View all results</a>`;
      results.innerHTML = html;
    },
    formatMoney(cents) {
      return window.theme?.moneyFormat?.replace(/\{\{\s*amount\s*\}\}/, (cents / 100).toFixed(2)) || `$${(cents / 100).toFixed(2)}`;
    }
  };

  // =========================================
  // CART DRAWER
  // =========================================
  const cartDrawer = {
    init() {
      const drawer = document.querySelector('[data-cart-drawer]');
      const overlay = document.querySelector('[data-cart-overlay]');
      const close = document.querySelector('[data-cart-close]');
      const toggles = document.querySelectorAll('[data-cart-toggle]');

      if (!drawer) return;

      toggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
          if (window.theme?.cartType === 'drawer') {
            e.preventDefault();
            this.open(drawer, overlay);
            this.refresh();
          }
        });
      });

      close?.addEventListener('click', () => this.close(drawer, overlay));
      overlay?.addEventListener('click', () => this.close(drawer, overlay));
    },
    open(drawer, overlay) {
      drawer.classList.add('is-open');
      overlay?.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    },
    close(drawer, overlay) {
      drawer.classList.remove('is-open');
      overlay?.classList.remove('is-open');
      document.body.style.overflow = '';
    },
    async refresh() {
      try {
        const response = await fetch('/cart.js');
        const cart = await response.json();
        this.updateUI(cart);
      } catch (e) {
        console.error('Cart refresh error:', e);
      }
    },
    updateUI(cart) {
      // Update cart count badges
      document.querySelectorAll('[data-cart-count]').forEach(el => {
        el.textContent = cart.item_count;
      });
    }
  };

  // =========================================
  // ADD TO CART
  // =========================================
  const addToCart = {
    init() {
      document.addEventListener('submit', async (e) => {
        const form = e.target.closest('[data-product-form], .product-card__form');
        if (!form) return;

        e.preventDefault();
        const btn = form.querySelector('[data-add-btn], button[type="submit"]');
        const originalText = btn?.textContent;

        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Adding...';
        }

        try {
          const formData = new FormData(form);
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) throw new Error('Add to cart failed');

          if (btn) btn.textContent = 'Added!';
          cartDrawer.refresh();

          // Open cart drawer
          const drawer = document.querySelector('[data-cart-drawer]');
          const overlay = document.querySelector('[data-cart-overlay]');
          if (drawer && window.theme?.cartType === 'drawer') {
            setTimeout(() => cartDrawer.open(drawer, overlay), 300);
          }
        } catch (err) {
          console.error(err);
          if (btn) btn.textContent = 'Error';
        } finally {
          setTimeout(() => {
            if (btn) {
              btn.disabled = false;
              btn.textContent = originalText;
            }
          }, 2000);
        }
      });
    }
  };

  // =========================================
  // QUANTITY SELECTORS
  // =========================================
  const quantitySelectors = {
    init() {
      document.addEventListener('click', (e) => {
        const minus = e.target.closest('[data-qty-minus]');
        const plus = e.target.closest('[data-qty-plus]');
        
        if (minus || plus) {
          const container = e.target.closest('.product-quantity');
          const input = container?.querySelector('[data-qty-input]');
          if (!input) return;

          let value = parseInt(input.value) || 1;
          if (minus && value > 1) value--;
          if (plus) value++;
          input.value = value;
        }
      });
    }
  };

  // =========================================
  // PRODUCT GALLERY
  // =========================================
  const productGallery = {
    init() {
      const thumbs = document.querySelectorAll('[data-thumb]');
      if (!thumbs.length) return;

      thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
          const mediaId = thumb.dataset.thumb;
          
          // Update active states
          thumbs.forEach(t => t.classList.remove('product-gallery__thumb--active'));
          thumb.classList.add('product-gallery__thumb--active');

          // Show corresponding slide
          document.querySelectorAll('.product-gallery__slide').forEach(slide => {
            slide.classList.toggle('product-gallery__slide--active', slide.dataset.mediaId === mediaId);
          });
        });
      });
    }
  };

  // =========================================
  // PRODUCT TABS
  // =========================================
  const productTabs = {
    init() {
      const tabs = document.querySelectorAll('[data-tab]');
      if (!tabs.length) return;

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.tab;
          
          tabs.forEach(t => t.classList.remove('product-tabs__tab--active'));
          tab.classList.add('product-tabs__tab--active');

          document.querySelectorAll('[data-panel]').forEach(panel => {
            panel.classList.toggle('product-tabs__panel--active', panel.dataset.panel === target);
          });
        });
      });
    }
  };

  // =========================================
  // STICKY ADD TO CART
  // =========================================
  const stickyCart = {
    init() {
      const sticky = document.querySelector('[data-sticky-cart]');
      const form = document.querySelector('[data-product-form]');
      if (!sticky || !form) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          sticky.classList.toggle('is-visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });

      observer.observe(form);

      // Sync sticky button with main form
      const stickyBtn = sticky.querySelector('[data-sticky-add]');
      stickyBtn?.addEventListener('click', () => {
        form.querySelector('[data-add-btn]')?.click();
      });
    }
  };

  // =========================================
  // QUICK VIEW
  // =========================================
  const quickView = {
    init() {
      const modal = document.querySelector('[data-quick-view-modal]');
      if (!modal) return;

      document.addEventListener('click', async (e) => {
        const trigger = e.target.closest('[data-quick-view]');
        if (trigger) {
          e.preventDefault();
          const handle = trigger.dataset.quickView;
          await this.open(handle, modal);
        }

        if (e.target.closest('[data-quick-view-close]')) {
          this.close(modal);
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
          this.close(modal);
        }
      });
    },
    async open(handle, modal) {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';

      try {
        const response = await fetch(`/products/${handle}?view=quick-view`);
        const html = await response.text();
        modal.querySelector('[data-quick-view-body]').innerHTML = html;
      } catch (e) {
        console.error('Quick view error:', e);
      }
    },
    close(modal) {
      modal.hidden = true;
      document.body.style.overflow = '';
      modal.querySelector('[data-quick-view-body]').innerHTML = '<div class="quick-view-loader"><div class="loader"></div></div>';
    }
  };

  // =========================================
  // FAQ ACCORDION
  // =========================================
  const faqAccordion = {
    init() {
      document.querySelectorAll('.faq-question').forEach(btn => {
        btn.addEventListener('click', () => {
          const expanded = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', !expanded);
          btn.nextElementSibling.classList.toggle('is-open');
        });
      });
    }
  };

  // =========================================
  // COLLECTION FILTERS
  // =========================================
  const collectionFilters = {
    init() {
      const toggle = document.querySelector('[data-filter-toggle]');
      const filters = document.querySelector('[data-filters]');

      if (toggle && filters) {
        toggle.addEventListener('click', () => {
          filters.classList.toggle('is-open');
        });
      }

      // Filter group toggles
      document.querySelectorAll('.filter-group__toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const expanded = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', !expanded);
          btn.nextElementSibling.style.display = expanded ? 'none' : 'block';
        });
      });

      // View toggles
      document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
          const view = btn.dataset.view;
          document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('view-toggle--active'));
          btn.classList.add('view-toggle--active');
          
          const grid = document.querySelector('[data-collection-grid]');
          if (grid) {
            grid.classList.toggle('collection-grid--list', view === 'list');
          }
        });
      });

      // Sort select
      const sortSelect = document.querySelector('[data-sort-select]');
      if (sortSelect) {
        sortSelect.addEventListener('change', () => {
          const url = new URL(window.location);
          url.searchParams.set('sort_by', sortSelect.value);
          window.location = url;
        });

        // Set current sort
        const currentSort = new URL(window.location).searchParams.get('sort_by');
        if (currentSort) sortSelect.value = currentSort;
      }
    }
  };

  // =========================================
  // BACK TO TOP
  // =========================================
  const backToTop = {
    init() {
      const btn = document.querySelector('[data-back-to-top]');
      if (!btn) return;

      window.addEventListener('scroll', () => {
        btn.classList.toggle('is-visible', window.scrollY > 500);
      });

      btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  // =========================================
  // COOKIE CONSENT
  // =========================================
  const cookieConsent = {
    init() {
      const banner = document.querySelector('[data-cookie-consent]');
      if (!banner || localStorage.getItem('cookieConsent')) return;

      setTimeout(() => {
        banner.hidden = false;
        banner.classList.add('is-visible');
      }, 2000);

      banner.querySelector('[data-cookie-accept]')?.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'accepted');
        banner.classList.remove('is-visible');
      });

      banner.querySelector('[data-cookie-decline]')?.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'declined');
        banner.classList.remove('is-visible');
      });
    }
  };

  // =========================================
  // NEWSLETTER POPUP
  // =========================================
  const newsletterPopup = {
    init() {
      const popup = document.querySelector('[data-newsletter-popup]');
      if (!popup || sessionStorage.getItem('popupShown')) return;

      setTimeout(() => {
        popup.hidden = false;
        sessionStorage.setItem('popupShown', 'true');
      }, 5000);

      popup.querySelectorAll('[data-popup-close]').forEach(el => {
        el.addEventListener('click', () => {
          popup.hidden = true;
        });
      });
    }
  };

  // =========================================
  // RECENTLY VIEWED
  // =========================================
  const recentlyViewed = {
    init() {
      const container = document.querySelector('[data-recently-viewed]');
      const grid = document.querySelector('[data-recently-viewed-grid]');
      if (!container || !grid) return;

      const viewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      const currentId = container.closest('[data-product-id]')?.dataset.productId;
      const filtered = viewed.filter(p => String(p.id) !== currentId).slice(0, 4);

      if (filtered.length < 2) return;

      container.hidden = false;
      grid.innerHTML = filtered.map(p => `
        <a href="${p.url}" class="product-card" style="text-decoration:none">
          <div class="product-card__image">
            <img src="${p.image}" alt="${p.title}" loading="lazy">
          </div>
          <div class="product-card__content">
            ${p.vendor ? `<p class="product-card__vendor">${p.vendor}</p>` : ''}
            <h3 class="product-card__title">${p.title}</h3>
            <p class="product-card__price"><span class="product-card__price-current">${p.price}</span></p>
          </div>
        </a>
      `).join('');
    }
  };

  // =========================================
  // COUNTDOWN TIMER
  // =========================================
  const countdown = {
    init() {
      const el = document.querySelector('[data-countdown]');
      if (!el) return;

      const target = new Date(el.dataset.countdown).getTime();
      
      const update = () => {
        const now = Date.now();
        const diff = target - now;
        
        if (diff <= 0) {
          el.textContent = 'Ended';
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        el.textContent = `${days}d ${hours}h ${mins}m ${secs}s`;
      };

      update();
      setInterval(update, 1000);
    }
  };

  // =========================================
  // INIT
  // =========================================
  document.addEventListener('DOMContentLoaded', () => {
    mobileMenu.init();
    predictiveSearch.init();
    cartDrawer.init();
    addToCart.init();
    quantitySelectors.init();
    productGallery.init();
    productTabs.init();
    stickyCart.init();
    quickView.init();
    faqAccordion.init();
    collectionFilters.init();
    backToTop.init();
    cookieConsent.init();
    newsletterPopup.init();
    recentlyViewed.init();
    countdown.init();
  });

})();
