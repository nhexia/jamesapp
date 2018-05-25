var offerMinAmount = 500;


/*============================================================================
  Ajax the add to cart experience by revealing it in a side drawer
  Plugin Documentation - http://shopify.github.io/Timber/#ajax-cart
  (c) Copyright 2015 Shopify Inc. Author: Carson Shold (@cshold). All Rights Reserved.

  This file includes:
    - Basic Shopify Ajax API calls
    - Ajax cart plugin

  This requires:
    - jQuery 1.8+
    - handlebars.min.js (for cart template)
    - modernizer.min.js
    - snippet/ajax-cart-template.liquid

  Customized version of Shopify's jQuery API
  (c) Copyright 2009-2015 Shopify Inc. Author: Caroline Schnapp. All Rights Reserved.
==============================================================================*/
if ((typeof ShopifyAPI) === 'undefined') { ShopifyAPI = {}; }

/*============================================================================
  API Helper Functions
==============================================================================*/
function attributeToString(attribute) {
  if ((typeof attribute) !== 'string') {
    attribute += '';
    if (attribute === 'undefined') {
      attribute = '';
    }
  }
  return jQuery.trim(attribute);
};

/*============================================================================
  API Functions
==============================================================================*/
ShopifyAPI.onCartUpdate = function(cart) {
  // alert('There are now ' + cart.item_count + ' items in the cart.');
};

ShopifyAPI.updateCartNote = function(note, callback) {
  var params = {
    type: 'POST',
    url: '/cart/update.js',
    data: 'note=' + attributeToString(note),
    dataType: 'json',
    success: function(cart) {
      if ((typeof callback) === 'function') {
        callback(cart);
      }
      else {
        ShopifyAPI.onCartUpdate(cart);
      }
      OfferValidation(cart);
    },
    error: function(XMLHttpRequest, textStatus) {
      ShopifyAPI.onError(XMLHttpRequest, textStatus);
    }
  };
  jQuery.ajax(params);
};

ShopifyAPI.onError = function(XMLHttpRequest, textStatus) {
  var data = eval('(' + XMLHttpRequest.responseText + ')');
  if (!!data.message) {
    alert(data.message + '(' + data.status  + '): ' + data.description);
  }
};

/*============================================================================
  POST to cart/add.js returns the JSON of the cart
    - Allow use of form element instead of just id
    - Allow custom error callback
==============================================================================*/

var glob_line_item; //, glob_form;
var cartObj;
var formObj;
ShopifyAPI.addItemFromForm = function(form, callback, errorCallback) {
  var params = {
    type: 'POST',
    url: '/cart/add.js',
    data: jQuery(form).serialize(),
    dataType: 'json',
    success: function(line_item) {
      glob_line_item = line_item;
     formObj = form;
      if (typeof(upsell_main) === "function") { 
        upsell_main();        
      }

      jQuery.getJSON("/cart.js", function(cart){
        cartObj = cart;
      	setTimeout(function(){
        if (typeof(upsell_offer) === "function") { 
          
			var total_price = parseInt(Shopify.formatMoney(cartObj.total_price, '{{amount}}'));
                                                           
          
            

            setTimeout(function(){
              $('.close_image').click(function(){
                $('.site-header__cart-toggle').trigger('click');
              });
            },1000);

            jQuery('#giveacceptbtn,#giveclosebtn,.close_image,#facebox_overlay').on('click', function(){ 
              if ((typeof callback) === 'function') {
                callback(glob_line_item, formObj);
              }
              else {
                ShopifyAPI.onItemAdded(glob_line_item, formObj);
              }
            });
        } else { 
          if ((typeof callback) === 'function') {
            callback(glob_line_item, formObj);
          }
          else {
            ShopifyAPI.onItemAdded(glob_line_item, formObj);
          }
        }
      },1500);
        OfferValidation(glob_line_item);
      });
      
      
    },
    error: function(XMLHttpRequest, textStatus) {
      if ((typeof errorCallback) === 'function') {
        errorCallback(XMLHttpRequest, textStatus);
      }
      else {
        ShopifyAPI.onError(XMLHttpRequest, textStatus);
      }
    }
  };
  jQuery.ajax(params);
};

// Get from cart.js returns the cart in JSON
ShopifyAPI.getCart = function(callback) {
  jQuery.getJSON('/cart.js', function (cart, textStatus) {
    if ((typeof callback) === 'function') {
      callback(cart);
    }
    else {
      ShopifyAPI.onCartUpdate(cart);
    }
    OfferValidation(cart);
  });
};

// POST to cart/change.js returns the cart in JSON
ShopifyAPI.changeItem = function(line, quantity, callback) {
  var params = {
    type: 'POST',
    url: '/cart/change.js',
    data: 'quantity=' + quantity + '&line=' + line,
    dataType: 'json',
    success: function(cart) {
      //glob_line_item = cart;
      cartObj = cart;
      if ((typeof callback) === 'function') {
        callback(cart);
      }
      else {
        ShopifyAPI.onCartUpdate(cart);
      }
      if (typeof(upsell_main) === "function") {
          upsell_main();

        }
        setTimeout(function(){
        if (typeof(upsell_offer) === "function") { 
          
		var total_price = Shopify.formatMoney(cartObj.total_price,'{{amount}}');
                                              
            

            setTimeout(function(){
              $('.close_image').click(function(){
                $('.site-header__cart-toggle').trigger('click');
              });
            },1000);

        }
      },1500);
      OfferValidation(cart);
    },
    error: function(XMLHttpRequest, textStatus) {
      ShopifyAPI.onError(XMLHttpRequest, textStatus);
    }
    
  };
  jQuery.ajax(params);
};

/*============================================================================
  Ajax Shopify Add To Cart
==============================================================================*/
var ajaxCart = (function(module, $) {

  'use strict';

  // Public functions
  var init, loadCart;

  // Private general variables
  var settings, isUpdating, $body;

  // Private plugin variables
  var $formContainer, $addToCart, $cartCountSelector, $cartCostSelector, $cartContainer, $drawerContainer;

  // Private functions
  var updateCountPrice, formOverride, itemAddedCallback, itemErrorCallback, cartUpdateCallback, buildCart, cartCallback, adjustCart, adjustCartCallback, createQtySelectors, qtySelectors, validateQty;

  /*============================================================================
    Initialise the plugin and define global options
  ==============================================================================*/
  init = function (options) {

    // Default settings
    settings = {
      formSelector       : 'form[action^="/cart/add"]',
      cartContainer      : '#CartContainer',
      addToCartSelector  : 'input[type="submit"]',
      cartCountSelector  : null,
      cartCostSelector   : null,
      moneyFormat        : '$',
      disableAjaxCart    : false,
      enableQtySelectors : true
    };

    // Override defaults with arguments
    $.extend(settings, options);

    // Select DOM elements
    $formContainer     = $(settings.formSelector).not('[data-handle="wall-letters-for-nursery"]');
    $cartContainer     = $(settings.cartContainer);
    $addToCart         = $formContainer.find(settings.addToCartSelector);
    $cartCountSelector = $(settings.cartCountSelector);
    $cartCostSelector  = $(settings.cartCostSelector);

    // General Selectors
    $body = $('body');

    // Track cart activity status
    isUpdating = false;

    // Setup ajax quantity selectors on the any template if enableQtySelectors is true
    if (settings.enableQtySelectors) {
      qtySelectors();
    }

    // Take over the add to cart form submit action if ajax enabled
    if (!settings.disableAjaxCart && $addToCart.length) {
      formOverride();
    }

    // Run this function in case we're using the quantity selector outside of the cart
    adjustCart();
  };

  loadCart = function () {
    $body.addClass('drawer--is-loading');
    ShopifyAPI.getCart(cartUpdateCallback);
  };

  updateCountPrice = function (cart) {
    if ($cartCountSelector) {
      $cartCountSelector.html(cart.item_count).removeClass('hidden-count');

      if (cart.item_count === 0) {
        $cartCountSelector.addClass('hidden-count');
      }
    }
    if ($cartCostSelector) {
      $cartCostSelector.html(Shopify.formatMoney(cart.total_price, settings.moneyFormat));
    }
  };

  formOverride = function () {
    $formContainer.on('submit', function(evt) {
      evt.preventDefault();
      var sizeSel = $('.swatch ul.sizes li.active').length;
	  if(($('.swatch ul.sizes').length > 0 && sizeSel > 0) || ($('.swatch ul.sizes').length == 0))
      {
		$('.swatch ul.sizes li').removeClass('active');
        // Add class to be styled if desired
        $addToCart.removeClass('is-added').addClass('is-adding');

        // Remove any previous quantity errors
        $('.qty-error').remove();

        ShopifyAPI.addItemFromForm(evt.target, itemAddedCallback, itemErrorCallback);
      }
      else
      {
      	alert('Please select '+amoutSizeVal);
      }
    });
  };

  itemAddedCallback = function (product) {
    $addToCart.removeClass('is-adding').addClass('is-added');

    ShopifyAPI.getCart(cartUpdateCallback);
    isAddToCart = true;
  };

  itemErrorCallback = function (XMLHttpRequest, textStatus) {
    var data = eval('(' + XMLHttpRequest.responseText + ')');
    $addToCart.removeClass('is-adding is-added');

    if (!!data.message) {
      if (data.status == 422) {
        $formContainer.after('<div class="errors qty-error">'+ data.description +'</div>')
      }
    }
  };

  cartUpdateCallback = function (cart) {
    // Update quantity and price
    updateCountPrice(cart);
    buildCart(cart);
  };

  buildCart = function (cart) {
    // Start with a fresh cart div
    $cartContainer.empty();

    // Show empty cart
    if (cart.item_count === 0) {
      $cartContainer
        .append('<p>' + "Your cart is currently empty." + '</p>');
      cartCallback(cart);
      return;
    }

    // Handlebars.js cart layout
    var items = [],
        item = {},
        data = {},
        source = $("#CartTemplate").html(),
        template = Handlebars.compile(source);

    // Add each item to our handlebars.js data
    $.each(cart.items, function(index, cartItem) {

      /* Hack to get product image thumbnail
       *   - If image is not null
       *     - Remove file extension, add _small, and re-add extension
       *     - Create server relative link
       *   - A hard-coded url of no-image
      */
      if (cartItem.image != null){
        var prodImg = cartItem.image.replace(/(\.[^.]*)$/, "_small$1").replace('http:', '');
      } else {
        var prodImg = "//cdn.shopify.com/s/assets/admin/no-image-medium-cc9732cb976dd349a0df1d39816fbcc7.gif";
      }

      // Create item's data object and add to 'items' array
      item = {
        id: cartItem.variant_id,
        line: index + 1, // Shopify uses a 1+ index in the API
        url: cartItem.url,
        img: prodImg,
        name: cartItem.product_title,
        variation: cartItem.variant_title,
        properties: cartItem.properties,
        itemAdd: cartItem.quantity + 1,
        itemMinus: cartItem.quantity - 1,
        itemQty: cartItem.quantity,
        price: Shopify.formatMoney(cartItem.price, settings.moneyFormat),
        vendor: cartItem.vendor
      };

      items.push(item);
    });

    // Gather all cart data and add to DOM
    data = {
      items: items,
      note: cart.note,
      totalPrice: Shopify.formatMoney(cart.total_price, settings.moneyFormat)
    }

    $cartContainer.append(template(data));
	try{
    OfferValidation();
    }catch(err){}
    cartCallback(cart);
  };
	var isAddToCart = false;
  cartCallback = function(cart) {
    
    $body.removeClass('drawer--is-loading');
    $body.trigger('ajaxCart.afterCartLoad', cart);
    if(isAddToCart)
    {
      setTimeout(function(){
      	$('.js-drawer-close').trigger('click');
      },8000);
      isAddToCart = false;
    }
    try{
    OfferValidation();
    }catch(err){}
  };

  adjustCart = function () {
    // Delegate all events because elements reload with the cart

    // Add or remove from the quantity
    $body.on('click', '.ajaxcart__qty-adjust', function() {
      var $el = $(this),
          line = $el.data('line'),
          $qtySelector = $el.siblings('.ajaxcart__qty-num'),
          qty = parseInt($qtySelector.val().replace(/\D/g, ''));

      var qty = validateQty(qty);

      // Add or subtract from the current quantity
      if ($el.hasClass('ajaxcart__qty--plus')) {
        qty += 1;
      } else {
        qty -= 1;
        if (qty <= 0) qty = 0;
      }

      // If it has a data-line, update the cart.
      // Otherwise, just update the input's number
      if (line) {
        updateQuantity(line, qty);
      } else {
        $qtySelector.val(qty);
      }
    });

    // Update quantity based on input on change
    $body.on('change', '.ajaxcart__qty-num', function() {
      var $el = $(this),
          line = $el.data('line'),
          qty = parseInt($el.val().replace(/\D/g, ''));

      var qty = validateQty(qty);

      // If it has a data-line, update the cart
      if (line) {
        updateQuantity(line, qty);
      }
    });

    // Prevent cart from being submitted while quantities are changing
    $body.on('submit', 'form.ajaxcart', function(evt) {
      if (isUpdating) {
        evt.preventDefault();
      }
    });

    // Highlight the text when focused
    $body.on('focus', '.ajaxcart__qty-adjust', function() {
      var $el = $(this);
      setTimeout(function() {
        $el.select();
      }, 50);
    });

    function updateQuantity(line, qty) {
      isUpdating = true;

      // Add activity classes when changing cart quantities
      var $row = $('.ajaxcart__row[data-line="' + line + '"]').addClass('is-loading');

      if (qty === 0) {
        $row.parent().addClass('is-removed');
      }

      // Slight delay to make sure removed animation is done
      setTimeout(function() {
        ShopifyAPI.changeItem(line, qty, adjustCartCallback);
      }, 250);
    }

    // Save note anytime it's changed
    $body.on('change', 'textarea[name="note"]', function() {
      var newNote = $(this).val();

      // Update the cart note in case they don't click update/checkout
      ShopifyAPI.updateCartNote(newNote, function(cart) {});
    });
  };

  adjustCartCallback = function (cart) {
    isUpdating = false;

    // Update quantity and price
    updateCountPrice(cart);

    // Reprint cart on short timeout so you don't see the content being removed
    setTimeout(function() {
      ShopifyAPI.getCart(buildCart);
    }, 150)
  };

  createQtySelectors = function() {
    // If there is a normal quantity number field in the ajax cart, replace it with our version
    if ($('input[type="number"]', $cartContainer).length) {
      $('input[type="number"]', $cartContainer).each(function() {
        var $el = $(this),
            currentQty = $el.val();

        var itemAdd = currentQty + 1,
            itemMinus = currentQty - 1,
            itemQty = currentQty;

        var source   = $("#AjaxQty").html(),
            template = Handlebars.compile(source),
            data = {
              id: $el.data('id'),
              itemQty: itemQty,
              itemAdd: itemAdd,
              itemMinus: itemMinus
            };

        // Append new quantity selector then remove original
        $el.after(template(data)).remove();
      });
    }
  };

  qtySelectors = function() {
    // Change number inputs to JS ones, similar to ajax cart but without API integration.
    // Make sure to add the existing name and id to the new input element
    var numInputs = $('input[type="number"]');

    if (numInputs.length) {
      numInputs.each(function() {
        var $el = $(this),
            currentQty = $el.val(),
            inputName = $el.attr('name'),
            inputId = $el.attr('id');

        var itemAdd = currentQty + 1,
            itemMinus = currentQty - 1,
            itemQty = currentQty;

        var source   = $("#JsQty").html(),
            template = Handlebars.compile(source),
            data = {
              id: $el.data('id'),
              itemQty: itemQty,
              itemAdd: itemAdd,
              itemMinus: itemMinus,
              inputName: inputName,
              inputId: inputId
            };

        // Append new quantity selector then remove original
        $el.after(template(data)).remove();
      });

      // Setup listeners to add/subtract from the input
      $('.js-qty__adjust').on('click', function() {
        var $el = $(this),
            id = $el.data('id'),
            $qtySelector = $el.siblings('.js-qty__num'),
            qty = parseInt($qtySelector.val().replace(/\D/g, ''));

        var qty = validateQty(qty);

        // Add or subtract from the current quantity
        if ($el.hasClass('js-qty__adjust--plus')) {
          qty += 1;
        } else {
          qty -= 1;
          if (qty < 1) 
          {
            qty = 0;
          }
        }
		try
        {
        	AjaxUpdateQty(qty, $(this));
        }catch(err){}
        // Update the input's number
        $qtySelector.val(qty);
      });
    }
  };

  validateQty = function (qty) {
    if((parseFloat(qty) == parseInt(qty)) && !isNaN(qty)) {
      // We have a valid number!
    } else {
      // Not a number. Default to 1.
      qty = 1;
    }
    return qty;
  };

  module = {
    init: init,
    load: loadCart
  };
  
  
  

  return module;

}(ajaxCart || {}, jQuery));


function AjaxUpdateQty(qty, elem)
  {
    var removeItem = false;
    if(qty <= 0)
    {
      removeItem = true
    }
    var prodRow = $(elem).closest('tr.main-cont')
    var itemId = $(prodRow).data('variant');
    var dataObj = {
      'quantity' : qty,
      'id' : itemId
    };
    $.ajax({
      url: '/cart/change.js',
      type: 'POST',
      dataType: 'json',
      data: dataObj,
      async: false,
      success: function(e){
        //glob_line_item = e;
        cartObj = e;
        AjaxUpdateCartValues(e);
        AjaxUpdateItemValues(prodRow,qty);
        if(removeItem)
        {
          $(prodRow).remove();
        }
        if (typeof(upsell_main) === "function") {
          upsell_main();

        }
        setTimeout(function(){
        if (typeof(upsell_offer) === "function") { 
          
var total_price = Shopify.formatMoney(cartObj.total_price, '{{amount}}');
                                      
            

            setTimeout(function(){
              $('.close_image').click(function(){
                $('.site-header__cart-toggle').trigger('click');
              });
            },1000);

        }
      },1500);
        OfferValidation(e);
      },
      error:function(e){
        console.log(e);
      }
    });
  }
function AjaxUpdateItemValues(prodRow,qty)
{
  
  var priceRaw = parseInt($(prodRow).data('price'));
  
  var price = Shopify.formatMoney(priceRaw*qty, '${{amount}}');
                                  
  $('.total-price',prodRow).html(price);
  
}
function AjaxUpdateCartValues(cart)
{
  
	$('.CartCount').html(cart.item_count);
  	var price = Shopify.formatMoney(cart.total_price, '${{amount}}');
  	$('.CartCost').html(price);
    $('.sub-total').html(price);
  
  if(cart.item_count <= 0)
  {
  	$('#cartform').slideUp(1500, function(){
      $('#empty-cart').slideDown(1500); 
    });
  }
}
function got_cart_success_cart(data) {
  var curCartAmount = parseFloat(Shopify.formatMoney(data.total_price, '{{amount}}'));
  try{
   ValidateWholesaleCart(curCartAmount);
  }catch(err){}
  try{
   DiscountCheck(curCartAmount);
  }catch(err){}
}
function OfferValidation(curCart)
{
  
  try
  {
    
    jQuery.getJSON("/cart.js", got_cart_success_cart);
  }catch(err){}
}


