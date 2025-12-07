/**
 * AED Empire Theme JavaScript
 * Version 2.0.0
 * Enhanced with accessibility, error handling, and performance optimizations
 */

(function() {
  'use strict';

  // =========================================
  // UTILITIES
  // =========================================
  const utils = {
    // Debounce function for performance
    debounce(fn, delay = 300) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
      };
    },

    // Throttle function for scroll events
    throttle(fn, limit = 100) {
      let inThrottle;
      return (...args) => {
        if (!inThrottle) {
          fn.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },

    // Announce to screen readers
    announce(message, priority = 'polite') {
      const region = document.getElementById('aria-live-region');
      if (region) {
        region.setAttribute('aria-live', priority);
        region.textContent = message;
        // Clear after announcement
        setTimeout(() => { region.textContent = ''; }, 1000);
      }
    },

    // Format money with store format
    formatMoney(cents) {
      const format = window.theme?.moneyFormat || '${{amount}}';
      const amount = (cents / 100).toFixed(2);
      return format.replace(/\{\{\s*amount\s*\}\}/, amount);
    },

    // Check if reduced motion is preferred
    prefersReducedMotion() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    // Safe JSON parse
    safeJSONParse(str, fallback = null) {
      try {
        return JSON.parse(str);
      } catch (e) {
        return fallback;
      }
    },

    // Safe local storage
    storage: {
      get(key, fallback = null) {
        try {
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item) : fallback;
        } catch (e) {
          return fallback;
        }
      },
      set(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (e) {
          return false;
        }
      }
    }
  };

  // =========================================
  // FOCUS TRAP (for modals/drawers)
  // =========================================
  const focusTrap = {
    trapped: null,
    previousFocus: null,

    trap(element) {
      this.previousFocus = document.activeElement;
      this.trapped = element;

      const focusables = this.getFocusableElements(element);
      if (focusables.length) {
        focusables[0].focus();
      }

      document.addEventListener('keydown', this.handleKeydown);
    },

    release() {
      document.removeEventListener('keydown', this.handleKeydown);
      if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
        this.previousFocus.focus();
      }
      this.trapped = null;
      this.previousFocus = null;
    },

    getFocusableElements(element) {
      return Array.from(element.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(el => el.offsetParent !== null);
    },

    handleKeydown: function(e) {
      if (!focusTrap.trapped || e.key !== 'Tab') return;

      const focusables = focusTrap.getFocusableElements(focusTrap.trapped);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

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
          const isOpen = content.classList.contains('is-open');
          content.classList.toggle('is-open');
          trigger.setAttribute('aria-expanded', !isOpen);
          const icon = trigger.querySelector('svg');
          if (icon) icon.style.transform = isOpen ? '' : 'rotate(180deg)';
        });
      });
    },

    open(menu, overlay) {
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      overlay?.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      focusTrap.trap(menu);
      utils.announce('Navigation menu opened');
    },

    close(menu, overlay) {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      overlay?.classList.remove('is-open');
      document.body.style.overflow = '';
      focusTrap.release();
      utils.announce('Navigation menu closed');
    }
  };

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
        container.setAttribute('aria-hidden', 'false');
        setTimeout(() => input?.focus(), 100);
        focusTrap.trap(container);
      });

      close?.addEventListener('click', () => this.closeSearch(container, input, results));

      const debouncedSearch = utils.debounce((query) => this.search(query, results), 300);

      input?.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
          results.innerHTML = '';
          return;
        }
        debouncedSearch(query);
      });

      // Close on escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !container.hidden) {
          this.closeSearch(container, input, results);
        }
      });
    },

    closeSearch(container, input, results) {
      container.hidden = true;
      container.setAttribute('aria-hidden', 'true');
      if (input) input.value = '';
      if (results) results.innerHTML = '';
      focusTrap.release();
    },

    async search(query, results) {
      try {
        results.innerHTML = '<div class="predictive-search__loading"><div class="loader"></div></div>';
        const response = await fetch(`/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product,collection,page&resources[limit]=6`);

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        this.render(data, results, query);
      } catch (e) {
        console.error('Search error:', e);
        results.innerHTML = '<p style="text-align:center;padding:20px;color:var(--color-text-light)">Search unavailable. Please try again.</p>';
      }
    },

    render(data, results, query) {
      const products = data.resources?.results?.products || [];
      let html = '';

      if (products.length) {
        html += '<div class="predictive-search__products" role="listbox">';
        products.forEach(p => {
          html += `
            <a href="${p.url}" class="predictive-search__product" role="option">
              <img src="${p.image || ''}" alt="" width="80" height="80" loading="lazy">
              <div>
                <span class="predictive-search__product-title">${this.escapeHtml(p.title)}</span>
                <span class="predictive-search__product-price">${utils.formatMoney(p.price)}</span>
              </div>
            </a>`;
        });
        html += '</div>';
        utils.announce(`${products.length} search results found`);
      }

      if (!html) {
        html = `<p style="text-align:center;color:var(--color-text-light);padding:20px">No results for "${this.escapeHtml(query)}"</p>`;
        utils.announce('No search results found');
      }

      html += `<a href="/search?q=${encodeURIComponent(query)}" class="btn btn--outline" style="display:block;text-align:center;margin-top:20px">View all results</a>`;
      results.innerHTML = html;
    },

    escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
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

      // Close on escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
          this.close(drawer, overlay);
        }
      });
    },

    open(drawer, overlay) {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      overlay?.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      focusTrap.trap(drawer);
      utils.announce('Cart drawer opened');
    },

    close(drawer, overlay) {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      overlay?.classList.remove('is-open');
      document.body.style.overflow = '';
      focusTrap.release();
      utils.announce('Cart drawer closed');
    },

    async refresh() {
      try {
        const response = await fetch('/cart.js');
        if (!response.ok) throw new Error('Cart fetch failed');
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
        el.setAttribute('aria-label', `${cart.item_count} items in cart`);
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
        const originalAriaLabel = btn?.getAttribute('aria-label');

        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Adding...';
          btn.setAttribute('aria-busy', 'true');
        }

        try {
          const formData = new FormData(form);
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.description || 'Add to cart failed');
          }

          if (btn) btn.textContent = 'Added!';
          utils.announce('Item added to cart', 'assertive');
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
          utils.announce(err.message || 'Could not add item to cart', 'assertive');
        } finally {
          setTimeout(() => {
            if (btn) {
              btn.disabled = false;
              btn.textContent = originalText;
              btn.setAttribute('aria-busy', 'false');
              if (originalAriaLabel) btn.setAttribute('aria-label', originalAriaLabel);
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
          const min = parseInt(input.min) || 1;
          const max = parseInt(input.max) || 999;

          if (minus && value > min) value--;
          if (plus && value < max) value++;

          input.value = value;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          utils.announce(`Quantity: ${value}`);
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
          thumbs.forEach(t => {
            t.classList.remove('product-gallery__thumb--active');
            t.setAttribute('aria-selected', 'false');
          });
          thumb.classList.add('product-gallery__thumb--active');
          thumb.setAttribute('aria-selected', 'true');

          // Show corresponding slide
          document.querySelectorAll('.product-gallery__slide').forEach(slide => {
            const isActive = slide.dataset.mediaId === mediaId;
            slide.classList.toggle('product-gallery__slide--active', isActive);
            slide.setAttribute('aria-hidden', !isActive);
          });
        });

        // Keyboard support
        thumb.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            thumb.click();
          }
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

          tabs.forEach(t => {
            t.classList.remove('product-tabs__tab--active');
            t.setAttribute('aria-selected', 'false');
          });
          tab.classList.add('product-tabs__tab--active');
          tab.setAttribute('aria-selected', 'true');

          document.querySelectorAll('[data-panel]').forEach(panel => {
            const isActive = panel.dataset.panel === target;
            panel.classList.toggle('product-tabs__panel--active', isActive);
            panel.setAttribute('aria-hidden', !isActive);
          });
        });

        // Keyboard navigation
        tab.addEventListener('keydown', (e) => {
          const tabList = Array.from(tabs);
          const currentIndex = tabList.indexOf(tab);
          let newIndex;

          switch (e.key) {
            case 'ArrowLeft':
              newIndex = currentIndex > 0 ? currentIndex - 1 : tabList.length - 1;
              break;
            case 'ArrowRight':
              newIndex = currentIndex < tabList.length - 1 ? currentIndex + 1 : 0;
              break;
            case 'Home':
              newIndex = 0;
              break;
            case 'End':
              newIndex = tabList.length - 1;
              break;
            default:
              return;
          }

          e.preventDefault();
          tabList[newIndex].focus();
          tabList[newIndex].click();
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
          sticky.setAttribute('aria-hidden', entry.isIntersecting);
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

        if (e.target.closest('[data-quick-view-close]') || e.target.matches('[data-quick-view-modal] > .quick-view-modal__overlay')) {
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
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      focusTrap.trap(modal);

      try {
        const response = await fetch(`/products/${handle}?view=quick-view`);
        if (!response.ok) throw new Error('Quick view load failed');
        const html = await response.text();
        modal.querySelector('[data-quick-view-body]').innerHTML = html;
        utils.announce('Quick view opened');
      } catch (e) {
        console.error('Quick view error:', e);
        modal.querySelector('[data-quick-view-body]').innerHTML = '<p style="text-align:center;padding:40px">Could not load product. Please try again.</p>';
      }
    },

    close(modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      modal.querySelector('[data-quick-view-body]').innerHTML = '<div class="quick-view-loader"><div class="loader"></div></div>';
      focusTrap.release();
      utils.announce('Quick view closed');
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
          const answer = btn.nextElementSibling;
          answer.classList.toggle('is-open');
          answer.setAttribute('aria-hidden', expanded);
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
      const overlay = document.querySelector('[data-filter-overlay]');

      if (toggle && filters) {
        toggle.addEventListener('click', () => {
          const isOpen = filters.classList.contains('is-open');
          filters.classList.toggle('is-open');
          filters.setAttribute('aria-hidden', isOpen);
          overlay?.classList.toggle('is-open');

          if (!isOpen) {
            document.body.style.overflow = 'hidden';
            focusTrap.trap(filters);
          } else {
            document.body.style.overflow = '';
            focusTrap.release();
          }
        });

        overlay?.addEventListener('click', () => {
          filters.classList.remove('is-open');
          overlay.classList.remove('is-open');
          document.body.style.overflow = '';
          focusTrap.release();
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
          document.querySelectorAll('[data-view]').forEach(b => {
            b.classList.remove('view-toggle--active');
            b.setAttribute('aria-pressed', 'false');
          });
          btn.classList.add('view-toggle--active');
          btn.setAttribute('aria-pressed', 'true');

          const grid = document.querySelector('[data-collection-grid]');
          if (grid) {
            grid.classList.toggle('collection-grid--list', view === 'list');
          }
          utils.announce(`View changed to ${view}`);
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

      const handleScroll = utils.throttle(() => {
        const isVisible = window.scrollY > 500;
        btn.classList.toggle('is-visible', isVisible);
        btn.setAttribute('aria-hidden', !isVisible);
      }, 100);

      window.addEventListener('scroll', handleScroll, { passive: true });

      btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: utils.prefersReducedMotion() ? 'auto' : 'smooth' });
        utils.announce('Scrolled to top');
      });
    }
  };

  // =========================================
  // COOKIE CONSENT
  // =========================================
  const cookieConsent = {
    init() {
      const banner = document.querySelector('[data-cookie-consent]');
      if (!banner || utils.storage.get('cookieConsent')) return;

      setTimeout(() => {
        banner.hidden = false;
        banner.classList.add('is-visible');
        banner.setAttribute('aria-hidden', 'false');
      }, 2000);

      banner.querySelector('[data-cookie-accept]')?.addEventListener('click', () => {
        utils.storage.set('cookieConsent', 'accepted');
        this.hideBanner(banner);
        utils.announce('Cookies accepted');
      });

      banner.querySelector('[data-cookie-decline]')?.addEventListener('click', () => {
        utils.storage.set('cookieConsent', 'declined');
        this.hideBanner(banner);
        utils.announce('Cookies declined');
      });
    },

    hideBanner(banner) {
      banner.classList.remove('is-visible');
      banner.setAttribute('aria-hidden', 'true');
      setTimeout(() => { banner.hidden = true; }, 300);
    }
  };

  // =========================================
  // NEWSLETTER POPUP
  // =========================================
  const newsletterPopup = {
    init() {
      const popup = document.querySelector('[data-newsletter-popup]');
      if (!popup || sessionStorage.getItem('popupShown')) return;

      const delay = (window.theme?.newsletterDelay || 5) * 1000;

      setTimeout(() => {
        popup.hidden = false;
        popup.setAttribute('aria-hidden', 'false');
        sessionStorage.setItem('popupShown', 'true');
        focusTrap.trap(popup);
      }, delay);

      popup.querySelectorAll('[data-popup-close]').forEach(el => {
        el.addEventListener('click', () => this.close(popup));
      });

      // Close on overlay click
      popup.querySelector('.newsletter-popup__overlay')?.addEventListener('click', () => {
        this.close(popup);
      });

      // Close on escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !popup.hidden) {
          this.close(popup);
        }
      });
    },

    close(popup) {
      popup.hidden = true;
      popup.setAttribute('aria-hidden', 'true');
      focusTrap.release();
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

      const viewed = utils.storage.get('recentlyViewed', []);
      const currentId = container.closest('[data-product-id]')?.dataset.productId;
      const filtered = viewed.filter(p => String(p.id) !== currentId).slice(0, 4);

      if (filtered.length < 2) return;

      container.hidden = false;
      container.setAttribute('aria-hidden', 'false');
      grid.innerHTML = filtered.map(p => `
        <a href="${p.url}" class="product-card" style="text-decoration:none">
          <div class="product-card__image">
            <img src="${p.image}" alt="${this.escapeHtml(p.title)}" loading="lazy" width="300" height="300">
          </div>
          <div class="product-card__content">
            ${p.vendor ? `<p class="product-card__vendor">${this.escapeHtml(p.vendor)}</p>` : ''}
            <h3 class="product-card__title">${this.escapeHtml(p.title)}</h3>
            <p class="product-card__price"><span class="product-card__price-current">${p.price}</span></p>
          </div>
        </a>
      `).join('');
    },

    escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },

    // Call this on product pages to save the viewed product
    track(product) {
      if (!product || !product.id) return;

      let viewed = utils.storage.get('recentlyViewed', []);
      viewed = viewed.filter(p => String(p.id) !== String(product.id));
      viewed.unshift(product);
      viewed = viewed.slice(0, 10);
      utils.storage.set('recentlyViewed', viewed);
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
      if (isNaN(target)) return;

      const update = () => {
        const now = Date.now();
        const diff = target - now;

        if (diff <= 0) {
          el.textContent = 'Ended';
          el.setAttribute('aria-label', 'Countdown ended');
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        el.textContent = `${days}d ${hours}h ${mins}m ${secs}s`;
        el.setAttribute('aria-label', `${days} days, ${hours} hours, ${mins} minutes, ${secs} seconds remaining`);
      };

      update();
      setInterval(update, 1000);
    }
  };

  // =========================================
  // LAZY LOAD IMAGES
  // =========================================
  const lazyImages = {
    init() {
      // Native lazy loading is already supported via loading="lazy" attribute
      // This adds IntersectionObserver fallback for older browsers
      if ('loading' in HTMLImageElement.prototype) return;

      const images = document.querySelectorAll('img[loading="lazy"]');
      if (!images.length) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
            }
            observer.unobserve(img);
          }
        });
      }, { rootMargin: '100px' });

      images.forEach(img => observer.observe(img));
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
    lazyImages.init();

    // Expose utils for external use
    window.themeUtils = utils;
    window.recentlyViewed = recentlyViewed;
  });

})();
