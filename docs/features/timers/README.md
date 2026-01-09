# Countdown Timers

Add urgency to your offers with countdown timers. Timers create a sense of scarcity and encourage customers to act before time runs out.

{% hint style="info" %}
**Plan Required:** GROWTH or PROFESSIONAL
{% endhint %}

## Why Use Countdown Timers?

- **Create urgency** - "Offer ends in 2:34:15"
- **Increase conversions** - Fear of missing out (FOMO)
- **Highlight limited deals** - Flash sales, daily deals
- **Boost engagement** - Dynamic, attention-grabbing

## Timer Types

### Fixed End Date Timer

Counts down to a specific date/time:
```
Summer Sale ends in:
2 days 14 hours 23 minutes
```

**Use for:**
- Sales events
- Product launches
- Seasonal promotions

### Recurring Timer

Resets daily/weekly:
```
Today's deal expires in:
4:23:15
```

**Use for:**
- Daily deals
- Flash sales
- Lunch specials

### Evergreen Timer

Personalized countdown per visitor:
```
Your exclusive offer expires in:
14:59:32
```

**Use for:**
- Welcome discounts
- Cart abandonment recovery
- Personalized offers

{% hint style="info" %}
Evergreen timers start when visitor first sees the offer, creating individual urgency.
{% endhint %}

### Stock-Based Timer

Countdown based on inventory:
```
Only 5 left at this price!
[████░░░░░░] 5 remaining
```

**Use for:**
- Limited quantity deals
- Scarcity marketing
- Inventory clearance

## Creating a Timer

### Step 1: Navigate to Timers

1. Go to **Countdown Timers** in the sidebar
2. Click **Create Timer**

### Step 2: Timer Configuration

**Timer Name**: Internal reference

**Timer Type**: Select from types above

**Timing Settings:**

For Fixed End Date:
- End date/time
- Timezone

For Recurring:
- Reset frequency (daily, weekly)
- Reset time

For Evergreen:
- Duration (hours, minutes)
- Cookie duration (when to reset)

### Step 3: Display Settings

**Position:**
- Product page (below title, above add to cart)
- Cart page
- Announcement bar
- Popup

**Design:**
- Timer style (digital, flip clock, simple)
- Colors (background, text, accent)
- Size (small, medium, large)

### Step 4: Link to Offer

Connect timer to a pricing rule or promotion:
- Select associated discount rule
- Timer shows when rule is active
- Both end together

### Step 5: Activate

1. Review settings
2. Click **Create Timer**
3. Toggle to **Active**

## Timer Display Styles

### Digital Clock

```
┌─────────────────────────────────┐
│  ⏱️ Sale ends in:               │
│   02 : 14 : 23 : 45            │
│  DAYS  HRS  MINS SECS          │
└─────────────────────────────────┘
```

### Flip Clock

Animated flipping numbers:
```
┌─────────────────────────────────┐
│  [02] : [14] : [23] : [45]     │
│  DAYS   HRS   MINS   SECS      │
└─────────────────────────────────┘
```

### Simple Text

```
Offer expires in 2 days, 14 hours
```

### Progress Bar

```
Sale ends in 14:23:45
[█████████████░░░░░░░░░░░░░░░░░]
```

### Circular

```
      ╭──────────╮
     │    02    │
     │   DAYS   │
      ╰──────────╯
```

## Display Locations

### Product Page

Show timer on qualifying products:
```
┌─────────────────────────────────────┐
│  Winter Jacket                      │
│  $149.99  $99.99 (33% off)         │
│                                     │
│  ⏱️ Flash Sale ends in:            │
│  04:23:15                          │
│                                     │
│  [Add to Cart]                      │
└─────────────────────────────────────┘
```

### Cart Page

Urgency at checkout decision:
```
┌─────────────────────────────────────┐
│  Your cart total: $247.50          │
│  You save: $82.50                  │
│                                     │
│  ⚠️ Your discounts expire in:      │
│  23:45:12                          │
│                                     │
│  [Checkout Now]                     │
└─────────────────────────────────────┘
```

### Announcement Bar

Site-wide visibility:
```
╔═════════════════════════════════════════════════════════╗
║  🔥 FLASH SALE: 30% off everything | Ends in 04:23:15  ║
╚═════════════════════════════════════════════════════════╝
```

### Popup

Entry or exit intent:
```
┌─────────────────────────────────────┐
│                                     │
│   ⏰ LIMITED TIME OFFER             │
│                                     │
│   Get 20% off your first order     │
│                                     │
│   Expires in: 14:59:32             │
│                                     │
│   [CLAIM OFFER]                     │
│                                     │
│   Use code: WELCOME20               │
│                                     │
└─────────────────────────────────────┘
```

## Timer Behavior

### When Timer Ends

Configure what happens at zero:

**Option 1: Hide**
- Timer disappears
- Discount no longer applies
- Product shows regular price

**Option 2: Show Expired Message**
```
"This offer has expired"
"Sign up to be notified of future deals"
```

**Option 3: Redirect**
- Redirect to different page
- Show alternative offer

**Option 4: Reset (Recurring)**
- Timer resets to start
- New countdown begins

### When Discount Ends Early

If you deactivate the rule:
- Timer stops immediately
- Shows expired or hides
- Synced with rule status

### Timezone Handling

- Set store timezone in settings
- Timer adjusts for visitor timezone
- Ends at correct local time

## Advanced Timer Features

### Multi-Product Timer

Same timer across products:
- All products in collection
- Coordinated sale end
- Consistent messaging

### Conditional Display

Show timer only when:
- Specific customer tags
- First-time visitors
- Cart value threshold
- Geographic location

### A/B Test Timers

Test timer effectiveness:
```
Group A: With timer
Group B: Without timer
Measure: Conversion rate difference
```

### Personalized Urgency

Different timers for different visitors:
```
New visitor: 48-hour welcome timer
Returning visitor: 24-hour exclusive timer
VIP: No timer (always has discount)
```

## Best Practices

### 1. Be Honest

- Don't fake scarcity
- Real deadlines build trust
- Evergreen timers are ethical when transparent

### 2. Match Timer to Offer Value

| Timer Duration | Offer Type |
|---------------|------------|
| 15-60 min | Flash sale, limited stock |
| 1-4 hours | Daily deal |
| 24-48 hours | Weekend sale |
| 3-7 days | Major promotion |

### 3. Use Sparingly

- Too many timers = noise
- Reserve for important offers
- Rotating timers lose impact

### 4. Mobile Optimization

- Ensure timer is visible on mobile
- Don't block key elements
- Test touch interactions

### 5. Clear End Behavior

- Tell customers what happens when timer ends
- "Price returns to $99.99"
- Set expectations

### 6. Test Timer Impact

A/B test to measure:
- Conversion rate change
- Revenue impact
- Customer perception

## Analytics

Track timer performance:

| Metric | Description |
|--------|-------------|
| Timer Views | Times timer was displayed |
| Conversions with Timer | Purchases while timer active |
| Conversion Lift | % increase vs. non-timer |
| Avg Time to Purchase | How quickly customers convert |
| Timer Completion | How many reach zero |

## Integration with Other Features

### With Pricing Rules

Timer automatically syncs with rule:
- Start/end dates match
- Deactivating rule stops timer
- Same targeting conditions

### With Cart Progress

Combine urgency with goals:
```
Free shipping when you spend $100
Offer ends in 02:34:15
Add $25 more to qualify!
```

### With BOGO

Timed BOGO offers:
```
Buy One Get One FREE
Limited time: 04:23:15 remaining
```

## Troubleshooting

### Timer not showing

1. Verify timer is "Active"
2. Check display location settings
3. Ensure app embed enabled
4. Clear cache

### Timer showing wrong time

1. Check timezone settings
2. Verify end date configuration
3. Test in incognito mode
4. Check for cached version

### Timer not syncing with discount

1. Verify timer linked to correct rule
2. Check rule is active
3. Ensure conditions match
4. Review rule end date

---

{% content-ref url="../pricing-rules/README.md" %}
[pricing-rules/README.md](../pricing-rules/README.md)
{% endcontent-ref %}

{% content-ref url="../cart-progress/README.md" %}
[cart-progress/README.md](../cart-progress/README.md)
{% endcontent-ref %}
