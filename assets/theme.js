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
      const toggles = document.querySelectorAll('[data-cart-toggle]');

      // Bind drawer events using event delegation (works even if drawer doesn't exist yet)
      this.bindDrawerEvents();

      // Cart icon click - open drawer or go to cart page
      toggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
          const currentDrawer = document.querySelector('[data-cart-drawer]');
          if (currentDrawer && window.theme?.cartType === 'drawer') {
            e.preventDefault();
            const currentOverlay = document.querySelector('[data-cart-overlay]');
            this.open(currentDrawer, currentOverlay);
            this.refresh();
          }
          // If no drawer or cartType is not 'drawer', let the link go to /cart
        });
      });

      // Close on overlay click (use event delegation)
      document.addEventListener('click', (e) => {
        if (e.target.matches('[data-cart-overlay]')) {
          const currentDrawer = document.querySelector('[data-cart-drawer]');
          const currentOverlay = document.querySelector('[data-cart-overlay]');
          if (currentDrawer?.classList.contains('is-open')) {
            this.close(currentDrawer, currentOverlay);
          }
        }
      });

      // Close on escape
      document.addEventListener('keydown', (e) => {
        const currentDrawer = document.querySelector('[data-cart-drawer]');
        if (e.key === 'Escape' && currentDrawer?.classList.contains('is-open')) {
          const currentOverlay = document.querySelector('[data-cart-overlay]');
          this.close(currentDrawer, currentOverlay);
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
      // Update cart count badges (supports both old and Dawn-style markup)
      document.querySelectorAll('[data-cart-count]').forEach(el => {
        // Check if it has a child span (Dawn-style) or is the text container itself
        const textEl = el.querySelector('span[aria-hidden]') || el;
        textEl.textContent = cart.item_count > 0 ? cart.item_count : '';
        el.setAttribute('data-count', cart.item_count);

        // Show/hide based on count
        if (cart.item_count > 0) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      });

      // Update subtotal
      const subtotal = document.querySelector('[data-cart-subtotal]');
      if (subtotal) {
        subtotal.textContent = this.formatMoney(cart.total_price);
      }

      // Update drawer count text
      const countText = document.querySelector('.cart-drawer__count');
      if (countText) {
        countText.textContent = `(${cart.item_count} ${cart.item_count === 1 ? 'item' : 'items'})`;
      }
    },

    formatMoney(cents) {
      const format = window.theme?.moneyFormat || '${{amount}}';
      const amount = (cents / 100).toFixed(2);
      return format.replace('{{amount}}', amount).replace('{{amount_no_decimals}}', Math.round(cents / 100));
    },

    async updateQuantity(key, quantity) {
      try {
        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: key, quantity: quantity })
        });
        if (!response.ok) throw new Error('Update failed');
        const cart = await response.json();
        this.updateUI(cart);
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));

        // Refresh drawer content if item was removed
        if (quantity === 0) {
          this.refreshDrawerContent();
        }
      } catch (e) {
        console.error('Cart update error:', e);
        utils.announce('Could not update cart', 'assertive');
      }
    },

    async refreshDrawerContent() {
      try {
        const response = await fetch('/?section_id=cart-drawer');
        if (!response.ok) return;
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newDrawer = doc.querySelector('.cart-drawer');
        const currentDrawer = document.querySelector('.cart-drawer');
        if (newDrawer && currentDrawer) {
          currentDrawer.innerHTML = newDrawer.innerHTML;
          // No need to rebind events - using event delegation on document
        }
      } catch (e) {
        console.error('Drawer refresh error:', e);
      }
    },

    bindDrawerEvents() {
      // Use event delegation on document for cart drawer events
      // This ensures events work even when drawer content is replaced
      document.addEventListener('click', (e) => {
        // Quantity buttons
        const qtyBtn = e.target.closest('[data-qty-change]');
        if (qtyBtn) {
          const key = qtyBtn.dataset.qtyChange;
          const action = qtyBtn.dataset.qtyAction;
          const input = document.querySelector(`[data-qty-input="${key}"]`);
          if (!input) return;

          let qty = parseInt(input.value) || 1;
          if (action === 'minus') qty = Math.max(0, qty - 1);
          if (action === 'plus') qty = Math.min(99, qty + 1);

          input.value = qty;
          this.updateQuantity(key, qty);
          return;
        }

        // Remove buttons
        const removeBtn = e.target.closest('[data-remove-item]');
        if (removeBtn) {
          const key = removeBtn.dataset.removeItem;
          this.updateQuantity(key, 0);
          return;
        }

        // Order note toggle
        const noteToggle = e.target.closest('.cart-drawer__note-toggle');
        if (noteToggle) {
          const field = document.querySelector('.cart-drawer__note-field');
          const isExpanded = noteToggle.getAttribute('aria-expanded') === 'true';
          noteToggle.setAttribute('aria-expanded', !isExpanded);
          if (field) field.hidden = isExpanded;
          return;
        }

        // Close button
        const closeBtn = e.target.closest('[data-cart-close]');
        if (closeBtn) {
          const drawer = document.querySelector('[data-cart-drawer]');
          const overlay = document.querySelector('[data-cart-overlay]');
          if (drawer) this.close(drawer, overlay);
          return;
        }
      });

      // Quantity input change (use event delegation)
      document.addEventListener('change', (e) => {
        const input = e.target.closest('.cart-drawer__qty-input');
        if (input) {
          const key = input.dataset.qtyInput;
          const qty = parseInt(input.value) || 0;
          this.updateQuantity(key, qty);
        }
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

          if (btn) {
            btn.textContent = 'Added!';
            btn.classList.add('btn--added');
          }
          utils.announce('Item added to cart', 'assertive');

          // Update cart count AND refresh drawer content
          cartDrawer.refresh();
          await cartDrawer.refreshDrawerContent();

          // Pulse animation on cart count
          document.querySelectorAll('[data-cart-count]').forEach(el => {
            el.classList.remove('cart-count--pulse');
            void el.offsetWidth; // Force reflow to restart animation
            el.classList.add('cart-count--pulse');
          });

          // Open cart drawer
          const drawer = document.querySelector('[data-cart-drawer]');
          const overlay = document.querySelector('[data-cart-overlay]');
          if (drawer && window.theme?.cartType === 'drawer') {
            cartDrawer.open(drawer, overlay);
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
              btn.classList.remove('btn--added');
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
          // Find the answer div - it's a sibling of the h3 parent, not the button
          const faqItem = btn.closest('.faq-item');
          const answer = faqItem ? faqItem.querySelector('.faq-answer') : null;
          if (answer) {
            answer.classList.toggle('is-open', !expanded);
            answer.setAttribute('aria-hidden', expanded);
          }
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

      // Collection description toggle
      const descToggle = document.querySelector('[data-description-toggle]');
      if (descToggle) {
        descToggle.addEventListener('click', () => {
          const container = descToggle.closest('[data-collection-description]');
          const preview = container.querySelector('.collection-description__preview');
          const full = container.querySelector('.collection-description__full');
          const moreText = descToggle.querySelector('.toggle-more');
          const lessText = descToggle.querySelector('.toggle-less');

          const isExpanded = descToggle.getAttribute('aria-expanded') === 'true';

          descToggle.setAttribute('aria-expanded', !isExpanded);
          preview.hidden = !isExpanded;
          full.hidden = isExpanded;
          moreText.hidden = !isExpanded;
          lessText.hidden = isExpanded;
        });
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
  // PRODUCT LIGHTBOX
  // =========================================
  const productLightbox = {
    currentIndex: 0,
    images: [],

    init() {
      const lightbox = document.querySelector('[data-product-lightbox]');
      const zoomContainers = document.querySelectorAll('[data-zoom-trigger]');

      if (!lightbox || !zoomContainers.length) return;

      // Collect all images
      this.images = Array.from(document.querySelectorAll('[data-lightbox-src]')).map(el => ({
        src: el.dataset.lightboxSrc,
        alt: el.getAttribute('alt') || ''
      }));

      // Open lightbox on click
      zoomContainers.forEach((trigger, index) => {
        trigger.addEventListener('click', () => this.open(lightbox, index));
      });

      // Close button
      lightbox.querySelector('[data-lightbox-close]')?.addEventListener('click', () => this.close(lightbox));

      // Navigation
      lightbox.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => this.prev(lightbox));
      lightbox.querySelector('[data-lightbox-next]')?.addEventListener('click', () => this.next(lightbox));

      // Overlay click
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) this.close(lightbox);
      });

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('is-open')) return;
        if (e.key === 'Escape') this.close(lightbox);
        if (e.key === 'ArrowLeft') this.prev(lightbox);
        if (e.key === 'ArrowRight') this.next(lightbox);
      });
    },

    open(lightbox, index) {
      this.currentIndex = index;
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      this.updateImage(lightbox);
      focusTrap.trap(lightbox);
      utils.announce('Image lightbox opened. Use arrow keys to navigate.');
    },

    close(lightbox) {
      lightbox.classList.remove('is-open');
      document.body.style.overflow = '';
      focusTrap.release();
      utils.announce('Image lightbox closed');
    },

    prev(lightbox) {
      this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
      this.updateImage(lightbox);
    },

    next(lightbox) {
      this.currentIndex = (this.currentIndex + 1) % this.images.length;
      this.updateImage(lightbox);
    },

    updateImage(lightbox) {
      const img = lightbox.querySelector('[data-lightbox-image]');
      const counter = lightbox.querySelector('[data-lightbox-counter]');

      if (img && this.images[this.currentIndex]) {
        img.src = this.images[this.currentIndex].src;
        img.alt = this.images[this.currentIndex].alt;
      }

      if (counter) {
        counter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
      }

      utils.announce(`Image ${this.currentIndex + 1} of ${this.images.length}`);
    }
  };

  // =========================================
  // SALE COUNTDOWN TIMER (Enhanced)
  // =========================================
  const saleCountdown = {
    init() {
      document.querySelectorAll('[data-sale-countdown]').forEach(el => {
        const endDate = el.dataset.saleCountdown;
        if (!endDate) return;

        const target = new Date(endDate).getTime();
        if (isNaN(target)) return;

        this.update(el, target);
        setInterval(() => this.update(el, target), 1000);
      });
    },

    update(el, target) {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        el.innerHTML = '<span class="product-sale-countdown__label">Sale Ended</span>';
        el.setAttribute('aria-label', 'Sale has ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      el.querySelector('[data-countdown-days]').textContent = String(days).padStart(2, '0');
      el.querySelector('[data-countdown-hours]').textContent = String(hours).padStart(2, '0');
      el.querySelector('[data-countdown-mins]').textContent = String(mins).padStart(2, '0');
      el.querySelector('[data-countdown-secs]').textContent = String(secs).padStart(2, '0');

      el.setAttribute('aria-label', `Sale ends in ${days} days, ${hours} hours, ${mins} minutes, ${secs} seconds`);
    }
  };

  // =========================================
  // QUOTE REQUEST MODAL
  // =========================================
  const quoteModal = {
    init() {
      const modal = document.querySelector('[data-quote-modal]');
      if (!modal) return;

      // Open triggers (floating button and inline buttons)
      document.querySelectorAll('[data-quote-trigger]').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          this.open(modal);
        });
      });

      // Close button
      modal.querySelector('[data-quote-close]')?.addEventListener('click', () => this.close(modal));

      // Overlay click
      modal.querySelector('.quote-modal__overlay')?.addEventListener('click', () => this.close(modal));

      // Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
          this.close(modal);
        }
      });

      // Form submission
      modal.querySelector('form')?.addEventListener('submit', (e) => this.handleSubmit(e, modal));
    },

    open(modal) {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      focusTrap.trap(modal);
      utils.announce('Quote request form opened');
    },

    close(modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      focusTrap.release();
      utils.announce('Quote request form closed');
    },

    async handleSubmit(e, modal) {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn.textContent;

      btn.disabled = true;
      btn.textContent = 'Sending...';

      try {
        // In a real implementation, this would submit to a server/API
        await new Promise(resolve => setTimeout(resolve, 1000));

        form.innerHTML = `
          <div class="form__success">
            <h3>Thank You!</h3>
            <p>We've received your quote request and will contact you within 24 hours.</p>
          </div>
        `;
        utils.announce('Quote request submitted successfully', 'assertive');

        setTimeout(() => this.close(modal), 3000);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = originalText;
        utils.announce('Error submitting quote request. Please try again.', 'assertive');
      }
    }
  };

  // =========================================
  // B2B QUICK ORDER FORM
  // =========================================
  const quickOrderForm = {
    init() {
      const form = document.querySelector('[data-quick-order]');
      if (!form) return;

      // Add row button
      form.querySelector('[data-quick-order-add]')?.addEventListener('click', () => this.addRow(form));

      // Remove row buttons
      form.addEventListener('click', (e) => {
        if (e.target.closest('[data-quick-order-remove]')) {
          const row = e.target.closest('[data-quick-order-row]');
          if (form.querySelectorAll('[data-quick-order-row]').length > 1) {
            row.remove();
            utils.announce('Row removed');
          }
        }
      });

      // Form submission
      form.addEventListener('submit', (e) => this.handleSubmit(e, form));
    },

    addRow(form) {
      const rows = form.querySelector('[data-quick-order-rows]');
      const newRow = document.createElement('div');
      newRow.className = 'quick-order-form__row';
      newRow.setAttribute('data-quick-order-row', '');
      newRow.innerHTML = `
        <input type="text" class="quick-order-form__input" placeholder="SKU or Product Name" aria-label="SKU or Product Name" required>
        <input type="number" class="quick-order-form__input" placeholder="Qty" min="1" value="1" aria-label="Quantity" required>
        <button type="button" class="quick-order-form__remove" data-quick-order-remove aria-label="Remove row">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" stroke="#1a1a2e"/><line x1="6" y1="6" x2="18" y2="18" stroke="#1a1a2e"/></svg>
        </button>
      `;
      rows.appendChild(newRow);
      newRow.querySelector('input').focus();
      utils.announce('New row added');
    },

    async handleSubmit(e, form) {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      const rows = Array.from(form.querySelectorAll('[data-quick-order-row]'));

      const items = rows.map(row => ({
        sku: row.querySelector('input[type="text"]').value,
        qty: parseInt(row.querySelector('input[type="number"]').value) || 1
      })).filter(item => item.sku);

      if (!items.length) {
        utils.announce('Please enter at least one product', 'assertive');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Adding to Cart...';

      try {
        // In production, this would look up SKUs and add to cart
        await new Promise(resolve => setTimeout(resolve, 1500));

        utils.announce(`${items.length} items added to cart`, 'assertive');
        btn.textContent = 'Added!';

        // Reset form after success
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = originalText;
          form.reset();
        }, 2000);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = originalText;
        utils.announce('Error adding items to cart', 'assertive');
      }
    }
  };

  // =========================================
  // FREE SHIPPING PROGRESS BAR
  // =========================================
  const freeShippingProgress = {
    threshold: 10000, // $100 in cents

    init() {
      const progressBars = document.querySelectorAll('[data-shipping-progress]');
      if (!progressBars.length) return;

      // Get threshold from data attribute if provided
      const firstBar = progressBars[0];
      if (firstBar.dataset.shippingThreshold) {
        this.threshold = parseInt(firstBar.dataset.shippingThreshold);
      }

      this.update();

      // Update when cart changes
      document.addEventListener('cart:updated', () => this.update());
    },

    async update() {
      try {
        const response = await fetch('/cart.js');
        const cart = await response.json();
        const total = cart.total_price;
        const remaining = Math.max(0, this.threshold - total);
        const percentage = Math.min(100, (total / this.threshold) * 100);

        document.querySelectorAll('[data-shipping-progress]').forEach(el => {
          const fill = el.querySelector('[data-shipping-fill]');
          const text = el.querySelector('[data-shipping-text]');

          if (fill) fill.style.width = `${percentage}%`;

          if (text) {
            if (remaining <= 0) {
              text.innerHTML = '🎉 You\'ve qualified for <strong>FREE shipping!</strong>';
              el.classList.add('free-shipping-progress--achieved');
            } else {
              text.innerHTML = `Add <strong>${utils.formatMoney(remaining)}</strong> more for FREE shipping`;
              el.classList.remove('free-shipping-progress--achieved');
            }
          }
        });
      } catch (e) {
        console.error('Error updating shipping progress:', e);
      }
    }
  };

  // =========================================
  // ENHANCED STICKY ADD-TO-CART BAR
  // =========================================
  const stickyCartBar = {
    init() {
      const bar = document.querySelector('[data-sticky-cart-bar]');
      const form = document.querySelector('[data-product-form]');
      if (!bar || !form) return;

      // Show/hide based on scroll position
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          bar.classList.toggle('is-visible', !entry.isIntersecting);
          bar.setAttribute('aria-hidden', entry.isIntersecting);
        });
      }, { threshold: 0, rootMargin: '-100px 0px 0px 0px' });

      observer.observe(form);

      // Sync quantity
      const mainQty = form.querySelector('[data-qty-input]');
      const stickyQty = bar.querySelector('[data-sticky-qty-input]');

      if (mainQty && stickyQty) {
        mainQty.addEventListener('change', () => {
          stickyQty.value = mainQty.value;
        });
        stickyQty.addEventListener('change', () => {
          mainQty.value = stickyQty.value;
        });
      }

      // Sticky quantity buttons
      bar.querySelector('[data-sticky-qty-minus]')?.addEventListener('click', () => {
        const val = parseInt(stickyQty.value) || 1;
        if (val > 1) {
          stickyQty.value = val - 1;
          mainQty.value = val - 1;
          utils.announce(`Quantity: ${val - 1}`);
        }
      });

      bar.querySelector('[data-sticky-qty-plus]')?.addEventListener('click', () => {
        const val = parseInt(stickyQty.value) || 1;
        stickyQty.value = val + 1;
        mainQty.value = val + 1;
        utils.announce(`Quantity: ${val + 1}`);
      });

      // Add to cart from sticky bar
      bar.querySelector('[data-sticky-add]')?.addEventListener('click', () => {
        form.querySelector('[data-add-btn]')?.click();
      });
    }
  };

  // =========================================
  // WISHLIST SYSTEM
  // =========================================
  const wishlist = {
    STORAGE_KEY: 'aed_wishlist',

    init() {
      this.updateAllButtons();

      // Listen for wishlist button clicks
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-wishlist-add]');
        if (btn) {
          e.preventDefault();
          this.toggle(btn);
        }
      });

      // Listen for storage changes (sync across tabs)
      window.addEventListener('storage', (e) => {
        if (e.key === this.STORAGE_KEY) {
          this.updateAllButtons();
          window.dispatchEvent(new CustomEvent('wishlist:updated', {
            detail: { count: this.getList().length }
          }));
        }
      });

      // Expose globally
      window.updateWishlistButtons = () => this.updateAllButtons();
    },

    getList() {
      try {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
      } catch {
        return [];
      }
    },

    saveList(list) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent('wishlist:updated', {
          detail: { count: list.length }
        }));
      } catch {}
    },

    isInList(handle) {
      return this.getList().some(p => p.handle === handle);
    },

    toggle(btn) {
      const handle = btn.dataset.wishlistAdd;
      const list = this.getList();
      const existingIndex = list.findIndex(p => p.handle === handle);

      if (existingIndex > -1) {
        // Remove from wishlist
        list.splice(existingIndex, 1);
        this.saveList(list);
        this.updateButton(btn, false);
        utils.announce('Removed from wishlist');
      } else {
        // Add to wishlist
        const product = {
          handle: handle,
          id: btn.dataset.productId,
          title: btn.dataset.productTitle,
          price: parseInt(btn.dataset.productPrice) || 0,
          image: btn.dataset.productImage,
          url: btn.dataset.productUrl,
          available: btn.dataset.productAvailable === 'true'
        };
        list.push(product);
        this.saveList(list);
        this.updateButton(btn, true);
        utils.announce(`${product.title} added to wishlist`);
      }
    },

    updateButton(btn, isActive) {
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive);
      const text = btn.querySelector('.wishlist-btn__text');
      if (text) {
        text.textContent = isActive ? 'Saved' : 'Save';
      }
    },

    updateAllButtons() {
      document.querySelectorAll('[data-wishlist-add]').forEach(btn => {
        const handle = btn.dataset.wishlistAdd;
        this.updateButton(btn, this.isInList(handle));
      });

      // Update wishlist count in header if exists
      const countEl = document.querySelector('[data-wishlist-count]');
      if (countEl) {
        const count = this.getList().length;
        countEl.textContent = count;
        countEl.hidden = count === 0;
      }
    }
  };

  // =========================================
  // QUICK VIEW MODAL
  // =========================================
  const quickViewModal = {
    init() {
      // Listen for quick view button clicks
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-quick-view]');
        if (btn) {
          e.preventDefault();
          const handle = btn.dataset.quickView;
          await this.open(handle);
        }
      });
    },

    async open(handle) {
      try {
        // Fetch product data
        const response = await fetch(`/products/${handle}.js`);
        const product = await response.json();

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'quick-view-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'quick-view-title');
        modal.innerHTML = `
          <div class="quick-view-modal__overlay" data-quick-view-close></div>
          <div class="quick-view-modal__content">
            <button type="button" class="quick-view-modal__close" data-quick-view-close aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" stroke="#1a1a2e"/><line x1="6" y1="6" x2="18" y2="18" stroke="#1a1a2e"/></svg>
            </button>
            <div class="quick-view-modal__image">
              <img src="${product.featured_image}" alt="${product.title}" width="450" height="450">
            </div>
            <div class="quick-view-modal__info">
              <h2 id="quick-view-title" class="quick-view-modal__title">${product.title}</h2>
              <p class="quick-view-modal__price">${utils.formatMoney(product.price)}</p>
              <div class="quick-view-modal__description">${product.description?.substring(0, 200) || ''}...</div>
              <form class="quick-view-modal__form">
                <input type="hidden" name="id" value="${product.variants[0].id}">
                <button type="submit" class="btn btn--primary btn--full" ${!product.available ? 'disabled' : ''}>
                  ${product.available ? 'Add to Cart' : 'Sold Out'}
                </button>
              </form>
              <a href="${product.url}" class="quick-view-modal__link">View Full Details →</a>
            </div>
          </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Focus trap
        const focusable = modal.querySelectorAll('button, [href], input, select, textarea');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        first?.focus();

        // Event handlers
        const close = () => {
          modal.remove();
          document.body.style.overflow = '';
        };

        modal.querySelectorAll('[data-quick-view-close]').forEach(el => {
          el.addEventListener('click', close);
        });

        modal.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') close();
          if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        });

        // Add to cart from quick view
        const form = modal.querySelector('.quick-view-modal__form');
        form?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = form.querySelector('button[type="submit"]');
          btn.disabled = true;
          btn.innerHTML = '<span class="loader" style="width:20px;height:20px;border-width:2px"></span>';

          try {
            await fetch('/cart/add.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: [{ id: product.variants[0].id, quantity: 1 }] })
            });
            btn.textContent = 'Added!';
            document.dispatchEvent(new CustomEvent('cart:updated'));
            setTimeout(close, 1500);
          } catch (err) {
            btn.textContent = 'Error';
            btn.disabled = false;
          }
        });

      } catch (err) {
        console.error('Quick view error:', err);
      }
    }
  };

  // =========================================
  // RECENTLY VIEWED ENHANCEMENT
  // =========================================
  const recentlyViewedEnhanced = {
    init() {
      // Carousel navigation
      document.querySelectorAll('.recently-viewed__carousel').forEach(carousel => {
        const track = carousel.querySelector('.recently-viewed__track');
        const prevBtn = carousel.querySelector('.recently-viewed__nav--prev');
        const nextBtn = carousel.querySelector('.recently-viewed__nav--next');

        if (!track) return;

        const scrollAmount = 220;

        prevBtn?.addEventListener('click', () => {
          track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });

        nextBtn?.addEventListener('click', () => {
          track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });

        // Update button states
        track.addEventListener('scroll', () => {
          if (prevBtn) prevBtn.disabled = track.scrollLeft <= 0;
          if (nextBtn) nextBtn.disabled = track.scrollLeft + track.offsetWidth >= track.scrollWidth - 10;
        });

        // Initial state
        if (prevBtn) prevBtn.disabled = true;
      });
    }
  };

  // =========================================
  // VARIANT COLOR SWATCHES
  // =========================================
  const variantSwatches = {
    init() {
      document.querySelectorAll('[data-swatch-option]').forEach(swatch => {
        swatch.addEventListener('change', (e) => {
          const optionIndex = swatch.closest('[data-option-index]')?.dataset.optionIndex;
          const value = e.target.value;

          // Update the hidden select if exists
          const select = document.querySelector(`[data-option-select="${optionIndex}"]`);
          if (select) {
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Update variant display
          this.updateVariantInfo();
          utils.announce(`Selected: ${value}`);
        });
      });
    },

    updateVariantInfo() {
      // This would typically update price, availability, etc. based on variant
      const selectedOptions = Array.from(document.querySelectorAll('[data-swatch-option]:checked'))
        .map(input => input.value);

      // Dispatch event for other components to react
      document.dispatchEvent(new CustomEvent('variant:changed', {
        detail: { options: selectedOptions }
      }));
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

    // Premium features
    productLightbox.init();
    saleCountdown.init();
    quoteModal.init();
    quickOrderForm.init();
    freeShippingProgress.init();
    stickyCartBar.init();
    variantSwatches.init();

    // Premium+ features
    wishlist.init();
    quickViewModal.init();
    recentlyViewedEnhanced.init();

    // Expose utils for external use
    window.themeUtils = utils;
    window.recentlyViewed = recentlyViewed;
    window.wishlist = wishlist;
  });

})();
