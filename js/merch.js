// Square Configuration
const STORE_DISABLED = false;
const IS_PROD = true;

// Load correct Square SDK based on environment
const scriptSrc = IS_PROD 
  ? 'https://web.squarecdn.com/v1/square.js'
  : 'https://sandbox.web.squarecdn.com/v1/square.js';
const squareScript = document.createElement('script');
squareScript.src = scriptSrc;
squareScript.type = 'text/javascript';
document.head.appendChild(squareScript);

const SQUARE_APPLICATION_ID_SANDBOX = 'sandbox-sq0idb-J0Bx6tfRFEyaaAKmiwHmuQ';
const SQUARE_LOCATION_ID_SANDBOX = 'LK60F9JJD2Y34';

const SQUARE_APPLICATION_ID_PROD = 'sq0idp-s9BdjZO1nhabTCBTm0TEOg';
const SQUARE_LOCATION_ID_PROD = 'X3QSDKMRDNTE1';

const SQUARE_APPLICATION_ID = IS_PROD ? SQUARE_APPLICATION_ID_PROD : SQUARE_APPLICATION_ID_SANDBOX;
const SQUARE_LOCATION_ID = IS_PROD ? SQUARE_LOCATION_ID_PROD : SQUARE_LOCATION_ID_SANDBOX;

// Store Configuration

let payments;
let card;
let applePay;
let googlePay;
let debounceTimer;
let autocompleteService;
let placesService;

function initPlacesService() {
  autocompleteService = new google.maps.places.AutocompleteService();
  placesService = new google.maps.places.PlacesService(document.createElement('div'));
}

function getPlaceSuggestions(input, callback) {
  if (!autocompleteService) initPlacesService();

  autocompleteService.getPlacePredictions({
    input: input,
    types: ['address'],
    componentRestrictions: { country: 'us' }
  }, callback);
}

function getPlaceDetails(placeId, callback) {
  if (!placesService) initPlacesService();

  placesService.getDetails({
    placeId: placeId,
    fields: ['address_components']
  }, callback);
}

function showDropdown(predictions) {
  const dropdown = document.getElementById('address-dropdown');
  if (!predictions || !predictions.length) {
    dropdown.style.display = 'none';
    return;
  }

  dropdown.innerHTML = predictions.map(p => `
    <div class="address-suggestion" data-place-id="${p.place_id}" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #f0f0f0;">
      ${p.description}
    </div>
  `).join('') + `
    <div style="padding: 8px; text-align: right; background: #f9f9f9;">
      <img src="https://developers.google.com/static/maps/documentation/images/powered_by_google_on_white.png" alt="Powered by Google" style="height: 16px;">
    </div>
  `;
  dropdown.style.display = 'block';

  dropdown.querySelectorAll('.address-suggestion').forEach(item => {
    item.addEventListener('click', () => {
      const placeId = item.dataset.placeId;
      getPlaceDetails(placeId, (place) => {
        let street = '';
        let city = '';
        let state = '';
        let zip = '';

        place.address_components?.forEach(component => {
          const types = component.types;
          if (types.includes('street_number')) {
            street = component.long_name + ' ';
          }
          if (types.includes('route')) {
            street += component.long_name;
          }
          if (types.includes('locality')) {
            city = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            state = component.short_name;
          }
          if (types.includes('postal_code')) {
            zip = component.long_name;
          }
        });

        document.getElementById('customer-address').value = street.trim();
        document.getElementById('customer-city').value = city;
        document.getElementById('customer-state').value = state;
        document.getElementById('customer-zip').value = zip;
        dropdown.style.display = 'none';
      });
    });

    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#f5f5f5';
    });
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'white';
    });
  });
}

let autocomplete;

// State tax rates (simplified - in reality you'd want more comprehensive data)
const stateTaxRates = {
  'AL': 0.04, 'AK': 0.00, 'AZ': 0.056, 'AR': 0.065, 'CA': 0.0725, 'CO': 0.029, 'CT': 0.0635, 'DE': 0.00, 'FL': 0.06, 'GA': 0.04,
  'HI': 0.04, 'ID': 0.06, 'IL': 0.0625, 'IN': 0.07, 'IA': 0.06, 'KS': 0.065, 'KY': 0.06, 'LA': 0.0445, 'ME': 0.055, 'MD': 0.06,
  'MA': 0.0625, 'MI': 0.06, 'MN': 0.06875, 'MS': 0.07, 'MO': 0.04225, 'MT': 0.00, 'NE': 0.055, 'NV': 0.0685, 'NH': 0.00, 'NJ': 0.06625,
  'NM': 0.05125, 'NY': 0.08, 'NC': 0.0475, 'ND': 0.05, 'OH': 0.0575, 'OK': 0.045, 'OR': 0.00, 'PA': 0.06, 'RI': 0.07, 'SC': 0.06,
  'SD': 0.045, 'TN': 0.07, 'TX': 0.0625, 'UT': 0.0485, 'VT': 0.06, 'VA': 0.053, 'WA': 0.065, 'WV': 0.06, 'WI': 0.05, 'WY': 0.04
};

function getTaxRate(state) {
  return stateTaxRates[state] || 0;
}

async function updateOrderSummary() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const isStickersOnly = cart.every(item => item.category === 'sticker');
  
  // Update checkout items
  const itemsHtml = cart.map(item => {
    const itemImage = item.image || (item.images ? item.images[0] : '');
    const imageUrl = itemImage ? `../${itemImage}` : '';
    return `
      <div class="checkout-summary-item" style="align-items: center;">
        <div style="display: flex; align-items: center; flex: 1;">
          <img src="${imageUrl}" alt="${item.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; margin-right: 12px;">
          <span>${item.name} x${item.quantity}</span>
        </div>
        <span>$${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `;
  }).join('') + `
    <div style="border-top: 1px solid #ddd; margin: 8px 0;"></div>
    <div class="checkout-summary-item">
      <span>Shipping</span>
      <span id="selected-shipping-price">$0.00</span>
    </div>
  `;
  
  document.getElementById('checkout-items').innerHTML = itemsHtml;
  await updateShippingOptions(isStickersOnly);
  updateTotal();
}

async function updateShippingOptions(isStickersOnly) {
  const state = document.getElementById('customer-state').value;
  const zip = document.getElementById('customer-zip').value;
  const shippingOptionsContainer = document.getElementById('shipping-options');
  
  if (!state || !zip) {
    shippingOptionsContainer.innerHTML = '<div style="color: #999;">Enter address for shipping rates</div>';
    return;
  }
  
  let optionsHtml = '';
  
  if (isStickersOnly) {
    optionsHtml += `
      <div class="shipping-option" data-value="1.00" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border: 2px solid #007bff; border-radius: 4px; margin-bottom: 8px; cursor: pointer; background: #f8f9ff;">
        <label style="display: flex; align-items: center; cursor: pointer;"><input type="radio" name="shipping" value="1.00" checked style="margin-right: 8px;"> USPS First Class Mail</label>
        <span>$1.00</span>
      </div>
    `;
  }
  
  // Economy shipping option
  const checked = !isStickersOnly ? 'checked' : '';
  const selectedStyle = !isStickersOnly ? 'border: 2px solid #007bff; background: #f8f9ff;' : 'border: 1px solid #ddd; background: white;';
  optionsHtml += `
    <div class="shipping-option" data-value="5.00" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; ${selectedStyle} border-radius: 4px; margin-bottom: 8px; cursor: pointer;">
      <label style="display: flex; align-items: center; cursor: pointer;"><input type="radio" name="shipping" value="5.00" ${checked} style="margin-right: 8px;"> Economy</label>
      <span>$5.00</span>
    </div>
  `;
  
  shippingOptionsContainer.innerHTML = optionsHtml;
  
  // Add click handlers for shipping options
  document.querySelectorAll('.shipping-option').forEach(option => {
    option.addEventListener('click', () => {
      const radio = option.querySelector('input[type="radio"]');
      radio.checked = true;
      
      // Update styling
      document.querySelectorAll('.shipping-option').forEach(opt => {
        opt.style.border = '1px solid #ddd';
        opt.style.background = 'white';
      });
      option.style.border = '2px solid #007bff';
      option.style.background = '#f8f9ff';
      
      updateTotal();
    });
  });
}

function updateTotal() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const selectedShipping = document.querySelector('input[name="shipping"]:checked');
  const shipping = selectedShipping ? parseFloat(selectedShipping.value) : 0;
  const total = subtotal + shipping;
  
  document.getElementById('checkout-total').textContent = `$${total.toFixed(2)}`;
  const shippingPriceElement = document.getElementById('selected-shipping-price');
  if (shippingPriceElement) {
    shippingPriceElement.textContent = `$${shipping.toFixed(2)}`;
  }
  
  // Update shipping option styling
  document.querySelectorAll('.shipping-option').forEach(option => {
    const radio = option.querySelector('input[type="radio"]');
    if (radio && radio.checked) {
      option.style.border = '2px solid #007bff';
      option.style.background = '#f8f9ff';
    } else {
      option.style.border = '1px solid #ddd';
      option.style.background = 'white';
    }
  });
}

const products = [
  { id: '1', image: '../merch/sticker_1.JPG', name: 'Corgi Loaf Sticker', price: 4, category: 'sticker' },
  { id: '25', image: '../merch/sticker_25.JPG', name: 'Black Cat Loaf Sticker', price: 4, category: 'sticker' },
  { id: '2', image: '../merch/sticker_2.JPG', name: 'Black Meme Cat Sticker', price: 4, category: 'sticker' },
  { id: '26', image: '../merch/sticker_26.JPG', name: 'Do Not The Cat Sticker', price: 4, category: 'sticker' },
  { id: '5', image: '../merch/sticker_5.JPG', name: 'Corporate Slave Corgi Sticker', price: 4, category: 'sticker' },
  { id: '9', image: '../merch/sticker_9.JPG', name: 'Cat Matcha Sticker', price: 4, category: 'sticker' },
  { id: '21', image: '../merch/sticker_21.JPG', name: 'Sushi Cat Sticker', price: 4, category: 'sticker' },
  { id: '33', image: '../merch/sticker_33.JPG', name: 'Spirited Away Boba Sticker', price: 4, category: 'sticker' },
  { id: '8', image: '../merch/sticker_8.JPG', name: 'Spilled Chalk Cat Sticker', price: 4, category: 'sticker' },
  { id: '32', image: '../merch/sticker_32.JPG', name: 'Tendinitis Cat Sticker', price: 4, category: 'sticker' },
  { id: '4', image: '../merch/sticker_4.JPG', name: 'I Love Rocks Sticker', price: 4, category: 'sticker' },
  { id: '6', image: '../merch/sticker_6.JPG', name: 'Feroshus Predator Cat Sticker', price: 4, category: 'sticker' },
  { id: '7', image: '../merch/sticker_7.JPG', name: 'Driving Cat Sticker', price: 4, category: 'sticker' },
  { id: '22', image: '../merch/sticker_22.JPG', name: 'Driving Corgi Sticker', price: 4, category: 'sticker' },
  { id: '10', image: '../merch/sticker_10.JPG', name: 'Bee Cat Sticker', price: 4, category: 'sticker' },
  { id: '11', image: '../merch/sticker_11.JPG', name: 'Corgi Cat Soju Sticker', price: 4, category: 'sticker' },
  { id: '12', image: '../merch/sticker_12.JPG', name: 'Black Corgi-ish Sticker', price: 4, category: 'sticker' },
  { id: '30', image: '../merch/sticker_30.JPG', name: 'Orange Corgi-ish Sticker', price: 4, category: 'sticker' },
  { id: '16', image: '../merch/sticker_16.JPG', name: 'Corgi Paw Sticker', price: 4, category: 'sticker' },
  { id: '15', image: '../merch/sticker_15.JPG', name: 'Witch Cat Sticker', price: 4, category: 'sticker' },
  { id: '24', image: '../merch/sticker_24.JPG', name: 'Hot Pot Sticker', price: 4, category: 'sticker' },
  { id: '27', image: '../merch/sticker_27.JPG', name: 'Sticky Rice Cat Sticker', price: 4, category: 'sticker' },
  { id: '17', image: '../merch/sticker_17.JPG', name: 'Matcha Cat Sticker', price: 4, category: 'sticker' },
  { id: '23', image: '../merch/sticker_23.JPG', name: 'Coffee Dog Sticker', price: 4, category: 'sticker' },
  { id: '18', image: '../merch/sticker_18.JPG', name: 'Yellow Climbing Shoe Sticker', price: 4, category: 'sticker' },
  { id: '19', image: '../merch/sticker_19.JPG', name: 'Pink Climbing Shoe Sticker', price: 4, category: 'sticker' },
  { id: '20', image: '../merch/sticker_20.JPG', name: 'Pink Choncc Sticker', price: 4, category: 'sticker' },
  { id: '13', image: '../merch/sticker_13.JPG', name: 'Pink Cat Stack Sticker', price: 4, category: 'sticker' },
  { id: '28', image: '../merch/sticker_28.JPG', name: 'Puppycat Sticker', price: 4, category: 'sticker' },
  { id: '35', image: '../merch/sticker_35.JPG', name: 'Totoro Mixer Sticker', price: 4, category: 'sticker' },
  { id: '14', image: '../merch/sticker_14.JPG', name: 'Angry Ramen Sticker', price: 4, category: 'sticker' },
  { id: '29', image: '../merch/sticker_29.JPG', name: 'Bee Cakepop Sticker', price: 4, category: 'sticker' },
  { id: '31', image: '../merch/sticker_31.JPG', name: 'Bee Boba Sticker', price: 4, category: 'sticker' },
  { id: '34', image: '../merch/sticker_34.JPG', name: 'Strawberry Bingsu Sticker', price: 4, category: 'sticker' },
  { id: '3', image: '../merch/sticker_3.JPG', name: 'Cat Climbing Tree Sticker', price: 4, category: 'sticker' },
  { id: '41', image: '../merch/charm2.JPG', name: 'Black Meme Cat Charm', price: 12, category: 'charm' },
  { id: '42', images: ['../merch/pin1.JPG', '../merch/pin2.JPG'], name: 'Black Meme Cat Pin', price: 12, category: 'pin' },
  { id: '38', images: ['../merch/chain3.JPG', '../merch/chain6.JPG'], name: 'Yellow Climbing Shoe Keychain', price: 12, category: 'chain' },
  { id: '39', images: ['../merch/chain5.JPG', '../merch/chain6.JPG'], name: 'Pink Climbing Shoe Keychain', price: 12, category: 'chain' },
  { id: '36', images: ['../merch/chain1.JPG', '../merch/chain2.JPG'], name: 'I Love Rocks Keychain', price: 12, category: 'chain' },
];

let cart = [];

// Load cart from localStorage on page load
function loadCart() {
  const savedCart = localStorage.getItem('burntloaf-cart');
  if (savedCart) {
    cart = JSON.parse(savedCart);
    updateCart();
  }
}

// Save cart to localStorage
function saveCart() {
  localStorage.setItem('burntloaf-cart', JSON.stringify(cart));
}

function loadProducts() {
  const gallery = document.getElementById('merch-gallery');
  const buttonDisabled = STORE_DISABLED ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : '';

  products.forEach(product => {
    const div = document.createElement('div');
    div.className = 'merch-item';

    // Check if product has multiple images (slideshow)
    if (product.images && product.images.length > 1) {
      const slideshowId = `slideshow-${product.id}`;
      const imagesHtml = product.images.map((img, idx) =>
        `<img src="${img}" alt="${product.name}" class="slideshow-image ${idx === 0 ? 'active' : ''}">`
      ).join('');

      const dotsHtml = product.images.map((_, idx) =>
        `<span class="slideshow-dot ${idx === 0 ? 'active' : ''}" onclick="goToSlide('${slideshowId}', ${idx})"></span>`
      ).join('');

      div.innerHTML = `
        <div class="merch-item-image">
          <div class="slideshow-container" id="${slideshowId}">
            ${imagesHtml}
            <button class="slideshow-arrow prev" onclick="changeSlide('${slideshowId}', -1)">‹</button>
            <button class="slideshow-arrow next" onclick="changeSlide('${slideshowId}', 1)">›</button>
            <div class="slideshow-nav">${dotsHtml}</div>
          </div>
        </div>
        <div class="merch-item-info">
          <div class="merch-item-name">${product.name}</div>
          <div class="merch-item-price">$${product.price.toFixed(2)}</div>
          <button class="merch-item-btn" ${buttonDisabled} onclick="addToCart('${product.id}')">Add to Cart</button>
        </div>
      `;
    } else {
      // Single image product
      const image = product.image || product.images[0];
      div.innerHTML = `
        <div class="merch-item-image">
          <img src="${image}" alt="${product.name}">
        </div>
        <div class="merch-item-info">
          <div class="merch-item-name">${product.name}</div>
          <div class="merch-item-price">$${product.price.toFixed(2)}</div>
          <button class="merch-item-btn" ${buttonDisabled} onclick="addToCart('${product.id}')">Add to Cart</button>
        </div>
      `;
    }

    gallery.appendChild(div);
  });
}

// Slideshow functions
function changeSlide(slideshowId, direction) {
  const container = document.getElementById(slideshowId);
  const images = container.querySelectorAll('.slideshow-image');
  const dots = container.querySelectorAll('.slideshow-dot');

  let currentIndex = Array.from(images).findIndex(img => img.classList.contains('active'));
  let newIndex = (currentIndex + direction + images.length) % images.length;

  images[currentIndex].classList.remove('active');
  dots[currentIndex].classList.remove('active');
  images[newIndex].classList.add('active');
  dots[newIndex].classList.add('active');
}

function goToSlide(slideshowId, index) {
  const container = document.getElementById(slideshowId);
  const images = container.querySelectorAll('.slideshow-image');
  const dots = container.querySelectorAll('.slideshow-dot');

  images.forEach(img => img.classList.remove('active'));
  dots.forEach(dot => dot.classList.remove('active'));

  images[index].classList.add('active');
  dots[index].classList.add('active');
}

function addToCart(productId) {
  if (STORE_DISABLED) {
    return; // Don't add to cart if store is disabled
  }

  const product = products.find(p => p.id === productId);
  const existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  updateCart();
  saveCart();
  animateCartIcon();
}

function removeFromCart(productId) {
  const index = cart.findIndex(item => item.id === productId);
  if (index > -1) {
    if (cart[index].quantity > 1) {
      cart[index].quantity--;
    } else {
      cart.splice(index, 1);
    }
  }
  updateCart();
  saveCart();
}

function updateCart() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  document.getElementById('cart-count').textContent = count;
  document.getElementById('cart-count').style.display = count > 0 ? 'flex' : 'none';
  document.getElementById('cart-total').textContent = `$${subtotal.toFixed(2)}`;

  const cartItems = document.getElementById('cart-items');
  if (cart.length === 0) {
    cartItems.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
  } else {
    cartItems.innerHTML = cart.map(item => {
      const itemImage = item.image || (item.images ? item.images[0] : '');
      return `
      <div class="cart-item">
        <div class="cart-item-image">
          <img src="${itemImage}" alt="${item.name}">
        </div>
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">$${item.price.toFixed(2)}</div>
          <div class="cart-item-controls">
            <button onclick="removeFromCart('${item.id}')">-</button>
            <span class="cart-item-quantity">${item.quantity}</span>
            <button onclick="addToCart('${item.id}')">+</button>
          </div>
        </div>
      </div>
    `}).join('');
  }
}

function animateCartIcon() {
  const icon = document.getElementById('cart-toggle');
  icon.style.transform = 'scale(1.2)';
  setTimeout(() => icon.style.transform = 'scale(1)', 200);
}

function checkout() {
  if (cart.length === 0) {
    alert('Your cart is empty!');
    return;
  }
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  alert(`Checkout coming soon!\n\nTotal: $${total.toFixed(2)}\nItems: ${cart.reduce((sum, item) => sum + item.quantity, 0)}`);
}

// Initialize Square Payments
async function initializeSquare() {
  if (!window.Square) {
    console.error('Square.js failed to load');
    document.getElementById('card-container').innerHTML = '<p style="color: red;">Failed to load payment form. Please refresh the page.</p>';
    return;
  }

  try {
    payments = window.Square.payments(SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID);

    // Initialize Card
    card = await payments.card();
    await card.attach('#card-container');

    console.log('Square initialized successfully');
  } catch (e) {
    console.error('Failed to initialize Square:', e);
    document.getElementById('card-container').innerHTML = '<p style="color: red;">Error: ' + e.message + '</p>';
  }
}

// Open Checkout Modal
function openCheckout() {
  if (cart.length === 0) {
    alert('Your cart is empty!');
    return;
  }

  document.getElementById('checkout-modal').classList.add('open');
  
  // Update order summary
  updateOrderSummary();

  // Initialize Square if not already done
  if (!payments) {
    initializeSquare();
  }
}

// Close Checkout Modal
function closeCheckout() {
  document.getElementById('checkout-modal').classList.remove('open');
  document.getElementById('payment-status-container').style.display = 'none';
  document.getElementById('payment-status-container').className = '';

  // Clear the containers first
  document.getElementById('card-container').innerHTML = '';
  document.getElementById('apple-pay-container').innerHTML = '';
  document.getElementById('google-pay-container').innerHTML = '';

  // Destroy payment forms to allow reinitialization
  if (card) {
    try { card.destroy(); } catch (e) { console.log('Card destroy error:', e); }
    card = null;
  }
  if (applePay) {
    try { applePay.destroy(); } catch (e) { console.log('Apple Pay destroy error:', e); }
    applePay = null;
  }
  if (googlePay) {
    try { googlePay.destroy(); } catch (e) { console.log('Google Pay destroy error:', e); }
    googlePay = null;
  }

  // Reset payments instance
  payments = null;

  // Re-enable the Pay Now button
  const cardButton = document.getElementById('card-button');
  cardButton.disabled = false;
  cardButton.textContent = 'Pay Now';
}

// Validate customer form
function validateCustomerForm() {
  const name = document.getElementById('customer-name').value.trim();
  const email = document.getElementById('customer-email').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const addressElement = document.getElementById('customer-address');
  const address = addressElement.value || addressElement.textContent || '';
  const address2 = document.getElementById('customer-address2').value.trim();
  const city = document.getElementById('customer-city').value.trim();
  const state = document.getElementById('customer-state').value;
  const zip = document.getElementById('customer-zip').value.trim();

  if (!name || !email || !phone || !address.trim() || !city || !state || !zip) {
    return { valid: false, message: 'Please fill in all shipping information' };
  }

  if (!email.includes('@')) {
    return { valid: false, message: 'Please enter a valid email address' };
  }

  return {
    valid: true,
    data: { name, email, phone, address: address.trim(), address2, city, state, zip }
  };
}

// Handle Payment (for card, Apple Pay, or Google Pay)
async function handlePayment(paymentMethod) {
  const cardButton = document.getElementById('card-button');
  const statusContainer = document.getElementById('payment-status-container');

  // Validate customer information first
  const validation = validateCustomerForm();
  if (!validation.valid) {
    statusContainer.className = 'error';
    statusContainer.textContent = validation.message;
    statusContainer.style.display = 'block';
    return;
  }

  cardButton.disabled = true;
  cardButton.textContent = 'Processing...';
  statusContainer.style.display = 'none';

  try {
    // Use the provided payment method or default to card
    const method = paymentMethod || card;
    const result = await method.tokenize();

    if (result.status === 'OK') {
      // Send payment token to your server
      const paymentResult = await processPayment(result.token);

      if (paymentResult.success) {
        statusContainer.className = 'success';
        statusContainer.textContent = 'Payment successful! Thank you for your order.';
        statusContainer.style.display = 'block';

        // Clear cart after successful payment
        setTimeout(() => {
          cart = [];
          updateCart();
          saveCart();
          closeCheckout();
          document.getElementById('cart-panel').classList.remove('open');
        }, 2000);
      } else {
        throw new Error(paymentResult.error || 'Payment failed');
      }
    } else {
      throw new Error('Card tokenization failed');
    }
  } catch (e) {
    statusContainer.className = 'error';
    statusContainer.textContent = `Payment failed: ${e.message}`;
    statusContainer.style.display = 'block';
    cardButton.disabled = false;
    cardButton.textContent = 'Pay Now';
    cardButton.disabled = false;
  }
}

// Process Payment (send to your server)
async function processPayment(token) {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const selectedShipping = document.querySelector('input[name="shipping"]:checked');
  const shipping = selectedShipping ? parseFloat(selectedShipping.value) : 0;
  const shippingMethod = selectedShipping ? selectedShipping.nextSibling.textContent.trim() : 'Standard';
  const total = subtotal + shipping;
  const amountInCents = Math.round(total * 100);
  const customerInfo = validateCustomerForm().data;

  const paymentData = {
    sourceId: token,
    amountMoney: {
      amount: amountInCents,
      currency: 'USD'
    },
    idempotencyKey: generateIdempotencyKey(),
    cart: cart,
    customer: customerInfo,
    shipping: {
      method: shippingMethod,
      cost: shipping
    }
  };

  // Try tunnel URL first, fallback to localhost
  const urls = [
    window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'https://api.burntloaf.cafe',
    'http://localhost:3000'
  ];

  for (const baseUrl of urls) {
    try {
      const response = await fetch(`${baseUrl}/api/process-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'An issue occurred with your payment. Please try again.');
      }

      return data;
    } catch (e) {
      console.log(`Failed to connect to ${baseUrl}:`, e.message);
      // Continue to next URL
    }
  }

  throw new Error('An issue occurred with your payment. Please try again.');
}

// Generate unique idempotency key
function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  loadCart();
  loadProducts();

  // Cart event listeners
  document.getElementById('cart-toggle').addEventListener('click', () => {
    document.getElementById('cart-panel').classList.add('open');
  });

  document.getElementById('cart-close').addEventListener('click', () => {
    document.getElementById('cart-panel').classList.remove('open');
  });

  // Attach event listener to Pay Now button
  document.getElementById('card-button').addEventListener('click', async () => {
    await handlePayment();
  });

  // Address autocomplete
  const addressInput = document.getElementById('customer-address');
  const dropdown = document.getElementById('address-dropdown');
  const stateSelect = document.getElementById('customer-state');

  addressInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const value = e.target.value;

    if (value.length < 3) {
      dropdown.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(() => {
      getPlaceSuggestions(value, (predictions) => {
        showDropdown(predictions);
      });
    }, 300);
  });

  // Update order summary when state or zip changes
  stateSelect.addEventListener('change', updateOrderSummary);
  document.getElementById('customer-zip').addEventListener('input', debounce(updateOrderSummary, 500));
  
  // Update total when shipping option changes
  document.addEventListener('change', (e) => {
    if (e.target.name === 'shipping') {
      updateTotal();
    }
  });

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

  document.addEventListener('click', (e) => {
    if (!addressInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
});
