# Troubleshooting

Solutions to common issues with Tiered Pricing Pro.

## Quick Diagnostics

Before diving into specific issues, run through this checklist:

1. ✅ Is the app installed and authorized?
2. ✅ Is your pricing rule set to "Active"?
3. ✅ Is the theme app extension enabled?
4. ✅ Have you cleared your browser cache?
5. ✅ Are you testing in an incognito/private window?

---

## Pricing Table Issues

### Pricing table not showing on product page

**Symptoms:**
- Product page loads but no pricing table visible
- Volume discounts work in cart but table missing

**Solutions:**

1. **Enable Theme App Extension**
   - Go to Shopify Admin > Online Store > Themes
   - Click "Customize" on your active theme
   - Click "App embeds" (bottom left)
   - Enable "Tiered Pricing" toggle
   - Save changes

2. **Check Rule Configuration**
   - Verify rule status is "Active"
   - Confirm product matches rule conditions
   - Check rule hasn't expired

3. **Check Theme Compatibility**
   - Some themes need manual integration
   - Contact support for custom theme help

4. **Clear Caches**
   - Clear browser cache
   - Clear Shopify theme cache (re-save theme)
   - Clear app cache in Settings

### Pricing table showing wrong information

**Symptoms:**
- Table shows incorrect tiers
- Prices don't match configuration

**Solutions:**

1. **Refresh Rule Data**
   - Edit and re-save the rule
   - Wait 2-3 minutes for propagation

2. **Check Rule Priority**
   - Higher priority rules override lower
   - Review all rules affecting the product

3. **Check Product Variants**
   - Each variant may have different prices
   - Ensure rule applies to all variants

---

## Discount Issues

### Discount not applying in cart

**Symptoms:**
- Product added to cart
- Quantity meets tier threshold
- No discount visible

**Solutions:**

1. **Verify Rule Conditions**
   ```
   Check each condition:
   □ Product/collection matches
   □ Quantity meets minimum
   □ Customer tag matches (if set)
   □ Date range is current (if set)
   □ Location matches (if geo-targeting)
   ```

2. **Check Stacking Settings**
   - If "Best price only" is set, check if another discount is better
   - Discount codes may override tiered pricing

3. **Verify Shopify Functions**
   - Go to Settings > Checkout
   - Ensure automatic discounts are enabled
   - Check Functions aren't disabled

4. **Test with Fresh Session**
   - Use incognito browser
   - Clear all cookies
   - Add products fresh

### Wrong discount amount

**Symptoms:**
- Discount applies but wrong amount
- Percentage seems off

**Solutions:**

1. **Check Tier Configuration**
   ```
   Verify:
   - Discount type (%, $, fixed price)
   - Discount value (10 vs 0.10)
   - Quantity range (min/max)
   ```

2. **Check Calculation Base**
   - Settings > "Calculate discount from"
   - Original price vs. current price
   - Before or after other discounts

3. **Check Rounding Settings**
   - Review rounding rules
   - Check decimal handling

4. **Verify Product Prices**
   - Compare original prices in Shopify
   - Check if compare-at-price is set

### Discount disappears at checkout

**Symptoms:**
- Discount visible in cart
- Gone when reaching checkout

**Solutions:**

1. **Check Checkout Integration**
   - Ensure Shopify Functions are deployed
   - Check for Functions errors in logs

2. **Review Discount Code Conflict**
   - If customer enters code, it may replace tiered discount
   - Adjust stacking settings if needed

3. **Check Draft Order Mode**
   - If using legacy mode, ensure it's configured
   - Upgrade to Functions for better reliability

---

## BOGO Issues

### BOGO not adding free item

**Symptoms:**
- Customer buys qualifying quantity
- Free item not automatically added

**Solutions:**

1. **Check BOGO Configuration**
   - Verify buy quantity is met
   - Check "get" product is in stock
   - Ensure variant is available

2. **Auto-add Settings**
   - Some BOGO requires manual add
   - Check "automatically add free item" setting

3. **Check Product Availability**
   - Free item must be purchasable
   - Check inventory settings

### Free item showing full price

**Symptoms:**
- Free item in cart but not $0
- Or shows wrong discount

**Solutions:**

1. **Verify Discount Type**
   - 100% off vs. free
   - Fixed amount off

2. **Check Cart Calculations**
   - Ensure all qualifying items present
   - Verify quantities match BOGO rules

---

## Customer Tag Issues

### Wholesale/VIP pricing not showing

**Symptoms:**
- Tagged customer logged in
- Still seeing retail prices

**Solutions:**

1. **Verify Customer is Logged In**
   - Customer must be signed into account
   - Check session is active

2. **Check Tag Spelling**
   - Tags are CASE-SENSITIVE
   - "Wholesale" ≠ "wholesale" ≠ "WHOLESALE"
   - Copy exact tag from Shopify Admin

3. **Verify Customer Has Tag**
   - Go to Shopify Admin > Customers
   - Find customer
   - Confirm tag is present

4. **Clear Session Cache**
   - Customer logs out and back in
   - Clear browser data

5. **Check Rule Condition**
   - Verify rule uses "Customer tags" condition
   - Ensure "contains" vs "equals" is correct

---

## Cart Progress Issues

### Progress bar not displaying

**Solutions:**

1. **Enable Cart Progress Feature**
   - Check feature is activated
   - Verify goal is set up

2. **Check Display Location**
   - Cart drawer vs. cart page
   - Enable in theme customizer

3. **Verify Threshold**
   - If cart already exceeds threshold, may hide
   - Check threshold amount

### Progress not updating

**Solutions:**

1. **Check JavaScript Loading**
   - Open browser console (F12)
   - Look for errors
   - Ensure scripts not blocked

2. **Theme Compatibility**
   - Some themes have AJAX cart issues
   - May need page refresh

---

## Performance Issues

### Store loading slowly

**Symptoms:**
- Pages take longer to load
- Performance degradation noted

**Solutions:**

1. **Check Number of Rules**
   - Too many active rules can slow calculations
   - Archive unused rules

2. **Optimize Conditions**
   - Avoid overly complex conditions
   - Use collections instead of individual products

3. **Review Caching**
   - Enable app caching
   - Increase cache duration

4. **Check Theme Integration**
   - Ensure only necessary scripts load
   - Lazy load pricing tables

### API Rate Limiting

**Symptoms:**
- Errors about too many requests
- Features temporarily unavailable

**Solutions:**

1. **Reduce API Calls**
   - Implement caching
   - Batch requests where possible

2. **Check Integration Code**
   - Look for loops making requests
   - Optimize custom code

---

## Sync Issues

### Rules not syncing between Shopify and app

**Solutions:**

1. **Force Sync**
   - Go to Settings
   - Click "Sync Now"
   - Wait for completion

2. **Check Shopify Connection**
   - Go to Settings > Account
   - Verify connection status
   - Re-authorize if needed

3. **Check for Errors**
   - Review app logs
   - Look for failed webhooks

### Product/Collection changes not reflected

**Solutions:**

1. **Sync Products**
   - Click refresh in product selector
   - Wait for sync to complete

2. **Check Product Status**
   - Archived products won't appear
   - Draft products may not work

---

## Installation Issues

### App won't install

**Solutions:**

1. **Check Shopify Plan**
   - Ensure your Shopify plan supports apps

2. **Clear Browser Data**
   - Clear cookies
   - Try different browser

3. **Check Permissions**
   - Store owner must install
   - Verify staff permissions

### Theme extension not appearing

**Solutions:**

1. **Check Theme Compatibility**
   - Online Store 2.0 themes supported
   - Legacy themes need manual integration

2. **Re-enable Extension**
   - Go to theme customizer
   - Toggle extension off then on
   - Save changes

---

## Billing Issues

### Charge not going through

**Solutions:**

1. **Check Shopify Billing**
   - Go to Shopify Admin > Settings > Billing
   - Verify payment method is valid
   - Check for failed charges

2. **Retry Charge**
   - Go to app Settings > Billing
   - Click retry payment

### Plan features not available after upgrade

**Solutions:**

1. **Wait for Propagation**
   - Can take up to 5 minutes
   - Try logging out and back in

2. **Verify Charge Completed**
   - Check Shopify billing history
   - Confirm charge was approved

---

## Getting More Help

### Collect Information

Before contacting support, gather:

1. **Store Information**
   - Store URL
   - Current plan
   - Theme name

2. **Issue Details**
   - Steps to reproduce
   - Screenshots/recordings
   - Browser and device

3. **Rule Configuration**
   - Export affected rules
   - Note relevant settings

4. **Error Messages**
   - Console errors (F12 > Console)
   - Any error notifications

### Contact Support

- **Email**: contact@novamentstudios.com
- **In-app Chat**: Available during business hours
- **Response Time**:
  - Professional: 4 hours
  - Growth: 24 hours
  - Free: 48 hours

### Debug Mode

Enable detailed logging:

1. Go to Settings > Advanced
2. Enable "Debug Mode"
3. Reproduce the issue
4. Export debug logs
5. Disable debug mode when done

{% hint style="warning" %}
Debug mode may slow down your store. Only enable temporarily.
{% endhint %}

---

{% content-ref url="faq.md" %}
[faq.md](faq.md)
{% endcontent-ref %}

{% content-ref url="support.md" %}
[support.md](support.md)
{% endcontent-ref %}
