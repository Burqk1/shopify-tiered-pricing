# Cart Progress Bar

The Cart Progress Bar motivates customers to add more items to their cart by showing how close they are to unlocking rewards like free shipping, discounts, or free gifts.

{% hint style="info" %}
**Plan Required:** GROWTH or PROFESSIONAL
{% endhint %}

## How It Works

The progress bar displays in the cart (and optionally site-wide) showing customers:
- Their current cart total
- The threshold to reach
- The reward they'll unlock
- Visual progress toward the goal

```
┌─────────────────────────────────────────────────┐
│  🚚 You're $25 away from FREE SHIPPING!        │
│  ████████████████░░░░░░░░░░░░░░  $75 / $100    │
│  [Continue Shopping]                            │
└─────────────────────────────────────────────────┘
```

## Benefits

- **Increases Average Order Value**: Customers add more to reach rewards
- **Reduces Cart Abandonment**: Clear goal motivates completion
- **Improves Customer Experience**: Transparent savings opportunities
- **Boosts Free Shipping Conversions**: Most effective for shipping thresholds

## Creating a Cart Progress Goal

### Step 1: Navigate to Cart Progress

1. Go to **Cart Progress** in the sidebar
2. Click **Create Goal**

### Step 2: Goal Configuration

**Goal Name**: Internal reference (e.g., "Free Shipping Goal")

**Threshold Amount**: Cart value to unlock reward
- Example: $100 for free shipping

**Reward Type**:
- Free Shipping
- Percentage Discount
- Fixed Amount Discount
- Free Gift

### Step 3: Messaging

Customize messages for each stage:

**Before Threshold:**
```
"You're {amount} away from FREE SHIPPING!"
"Spend {remaining} more to get 10% off!"
```

**At Threshold:**
```
"🎉 You've unlocked FREE SHIPPING!"
"Congratulations! Your 10% discount is applied!"
```

**Variables Available:**
- `{amount}` - Remaining amount needed
- `{remaining}` - Same as amount
- `{threshold}` - Goal amount
- `{current}` - Current cart total
- `{reward}` - Reward description

### Step 4: Design

**Progress Bar Style:**
- Horizontal bar (default)
- Circular progress
- Steps/milestones

**Colors:**
- Progress fill color
- Background color
- Text color
- Success color (when reached)

**Position:**
- Cart drawer only
- Cart page only
- Both locations
- Site-wide banner

### Step 5: Activate

1. Review settings
2. Click **Create Goal**
3. Toggle to **Active**

## Multi-Tier Progress

Create multiple milestones for increasing rewards:

```
Tier 1: $50  → 5% off
Tier 2: $100 → 10% off + Free Shipping
Tier 3: $150 → 15% off + Free Shipping + Free Gift
```

**Setup:**
1. Create goal with first threshold
2. Add additional tiers
3. Assign rewards to each tier
4. Customers see next achievable tier

**Display:**
```
┌──────────────────────────────────────────────────┐
│  Unlock More Rewards!                            │
│  ●────────●────────○────────○                    │
│  $50     $100      $150     $200                 │
│  5% off  10% off   Free     Free                 │
│  ✓       ✓ (next)  Gift     VIP                  │
│                                                  │
│  Add $28 more to unlock 10% off!                 │
└──────────────────────────────────────────────────┘
```

## Reward Types

### Free Shipping

Most popular reward type:
- Set threshold equal to or above your shipping cost
- Automatically removes shipping at checkout
- Great for stores with flat-rate shipping

### Percentage Discount

Apply store-wide or specific discount:
- 5-20% typical range
- Can target specific collections
- Stacks with or replaces other discounts

### Fixed Amount Discount

Dollar-off savings:
- "$10 off your order"
- Clear value proposition
- Good for higher-value stores

### Free Gift

Add a product to cart when threshold reached:
- Select gift product
- Auto-adds to cart at threshold
- Great for samples or promotional items

## Display Locations

### Cart Drawer

Embedded in slide-out cart:
- Most visible during shopping
- Updates in real-time
- Doesn't interrupt browsing

### Cart Page

Full-width bar on cart page:
- Prominent before checkout
- Last chance to upsell
- Can include product suggestions

### Announcement Bar

Site-wide at top of page:
- Visible on all pages
- Constant reminder
- Updates with cart changes

### Popup/Modal

Show after adding to cart:
- Immediate feedback
- Can suggest products
- More intrusive but effective

## Conditional Display

### Customer Segments

Show different goals to different customers:
- New customers: Lower threshold to convert
- Returning customers: Higher threshold with better reward
- VIP customers: Exclusive rewards

### Geographic Targeting

Adjust thresholds by location:
- Higher shipping costs = higher threshold
- Region-specific promotions
- Currency-appropriate amounts

### Time-Based

Schedule promotions:
- Weekend specials
- Holiday goals
- Limited-time lower thresholds

## Best Practices

### 1. Set Achievable Thresholds

Analyze your data:
- What's your current AOV?
- Set threshold 20-30% above AOV
- Too high = ignored, too low = no lift

### 2. Use Compelling Messaging

- Be specific: "$23.50 away" not "Almost there!"
- Show the reward clearly
- Create urgency without pressure

### 3. Match Reward to Threshold

| Threshold | Good Reward |
|-----------|-------------|
| $50-75 | 5% off or small gift |
| $75-100 | Free shipping |
| $100-150 | 10% off + free shipping |
| $150+ | Premium gift or 15%+ off |

### 4. Design for Visibility

- Use contrasting colors
- Make progress bar substantial (not tiny)
- Animate progress changes
- Celebrate reaching goal

### 5. Test and Optimize

- A/B test threshold amounts
- Try different reward types
- Monitor AOV changes
- Adjust based on conversion data

## Analytics

Track cart progress performance:

| Metric | Description |
|--------|-------------|
| Goal Views | Times progress bar displayed |
| Goals Reached | Customers who hit threshold |
| Conversion Rate | Views → Reached |
| AOV Lift | Change in average order value |
| Revenue Impact | Additional revenue attributed |
| Items Added | Extra items added to reach goal |

## Integration with Other Features

### With Tiered Pricing

Cart progress can work alongside volume discounts:
- Volume discount applies first
- Progress bar shows total with discounts applied
- Both benefits stack

### With Free Gifts

Combine progress reward with gift feature:
- Progress unlocks first gift
- Additional spend unlocks more
- Creates multi-tier gifting

### With BOGO

Progress calculates after BOGO discounts:
- BOGO items count toward threshold
- Both promotions apply

## Troubleshooting

### Progress bar not showing

1. Check goal is "Active"
2. Verify display location settings
3. Enable app embed in theme settings
4. Check customer segment targeting

### Reward not applying

1. Confirm cart meets threshold
2. Check reward configuration
3. Verify no conflicting discount codes
4. Review reward type settings

### Wrong amount displayed

1. Check currency settings
2. Verify tax inclusion settings
3. Review calculation (before/after discounts)

---

{% content-ref url="../gifts/README.md" %}
[gifts/README.md](../gifts/README.md)
{% endcontent-ref %}

{% content-ref url="../pricing-rules/README.md" %}
[pricing-rules/README.md](../pricing-rules/README.md)
{% endcontent-ref %}
