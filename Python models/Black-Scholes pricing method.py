# Import the required libraries
import numpy as np
import scipy.stats as si
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from matplotlib.cm import get_cmap

# Function to calculate put and call prices using Black-Scholes
def black_scholes(S, K, T, r, sigma, q=0):
    d1 = (np.log(S / K) + (r - q + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)

    call_price = (S * np.exp(-q * T) * si.norm.cdf(d1, 0.0, 1.0) -
                  K * np.exp(-r * T) * si.norm.cdf(d2, 0.0, 1.0))

    put_price = (K * np.exp(-r * T) * si.norm.cdf(-d2, 0.0, 1.0) -
                 S * np.exp(-q * T) * si.norm.cdf(-d1, 0.0, 1.0))

    return call_price, put_price

# Prompt the user for inputs
S = float(input("Enter the current stock price (S): "))
K_min = float(input("Enter the minimum strike price (K_min): "))
K_max = float(input("Enter the maximum strike price (K_max): "))

# Validate the specific strike price input
while True:
    K_specific = float(input(f"Enter the specific strike price (K) for price output (must be between {K_min} and {K_max}): "))
    if K_min <= K_specific <= K_max:
        break
    else:
        print(f"Error: K must be between {K_min} and {K_max}. Please enter a valid value.")

T = float(input("Enter the time to maturity (T) in years: "))
r = float(input("Enter the risk-free interest rate (r) in decimals (e.g., 0.05 for 5%): "))
sigma_base = float(input("Enter the base implied volatility (sigma) in decimals (e.g., 0.2 for 20%): "))
q = float(input("Enter the dividend yield (q) in decimals (e.g., 0 for no dividend): "))

# Calculate the specific call and put prices
specific_call_price, specific_put_price = black_scholes(S, K_specific, T, r, sigma_base, q)

# Define the volatility range (-10 basis points to +10 basis points)
volatility_range = np.arange(sigma_base - 0.1, sigma_base + 0.11, 0.03)

# Define 10 equal intervals for strike prices
strike_prices = np.linspace(K_min, K_max, 10)

# Initialize grids to store the calculated option prices
call_prices = np.zeros((len(volatility_range), len(strike_prices)))
put_prices = np.zeros((len(volatility_range), len(strike_prices)))

# Calculate the option prices over the grid
for i, sigma in enumerate(volatility_range):
    for j, K in enumerate(strike_prices):
        call_price, put_price = black_scholes(S, K, T, r, sigma, q)
        call_prices[i, j] = call_price
        put_prices[i, j] = put_price

# Adjust the extent to ensure the heat map covers the entire area
extent = [
    strike_prices.min() - (strike_prices[1] - strike_prices[0]) / 2,
    strike_prices.max() + (strike_prices[1] - strike_prices[0]) / 2,
    volatility_range.min() - (volatility_range[1] - volatility_range[0]) / 2,
    volatility_range.max() + (volatility_range[1] - volatility_range[0]) / 2
]

# Create the figure for both plots
plt.figure(figsize=(10, 8))

# Display the specific call and put prices above the graphs
plt.figtext(0.5, 0.95, f'Call Price: {specific_call_price:.2f} and Put Price: {specific_put_price:.2f} for K={K_specific}, T={T} years, σ={sigma_base}, S={S}', ha='center', fontsize=14, fontweight='bold')

# Plot the call option pricing heat map
plt.subplot(2, 1, 1)  # 2 rows, 1 column, 1st subplot
plt.imshow(call_prices, aspect='auto', cmap='viridis', origin='lower', extent=extent)
plt.colorbar(label='Call Option Price')

# Labeling the axes
plt.xlabel('Strike Price (K)')
plt.ylabel('Implied Volatility (σ)')
plt.title('Heatmap of Call Option Prices')

# Get the colormap and the normalization
cmap = get_cmap('viridis')
norm = Normalize(vmin=call_prices.min(), vmax=call_prices.max())

# Displaying numbers on the plot with color contrast adjustment
for i in range(len(volatility_range)):
    for j in range(len(strike_prices)):
        value = call_prices[i, j]
        color = cmap(norm(value))
        brightness = (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2])
        text_color = 'white' if brightness < 0.5 else 'black'
        plt.text(strike_prices[j], volatility_range[i], f'{value:.2f}',
                 ha='center', va='center', color=text_color)

# Customizing ticks to place intervals in the middle of the boxes
plt.xticks(ticks=strike_prices, labels=[f'{price:.2f}' for price in strike_prices], rotation=45)
plt.yticks(ticks=volatility_range, labels=[f'{vol:.2f}' for vol in volatility_range])

# Plot the put option pricing heat map
plt.subplot(2, 1, 2)  # 2 rows, 1 column, 2nd subplot
plt.imshow(put_prices, aspect='auto', cmap='viridis', origin='lower', extent=extent)
plt.colorbar(label='Put Option Price')

# Labeling the axes
plt.xlabel('Strike Price (K)')
plt.ylabel('Implied Volatility (σ)')
plt.title('Heatmap of Put Option Prices (Black-Scholes Method)')

# Get the colormap and the normalization
cmap = get_cmap('viridis')
norm = Normalize(vmin=put_prices.min(), vmax=put_prices.max())

# Displaying numbers on the plot with color contrast adjustment
for i in range(len(volatility_range)):
    for j in range(len(strike_prices)):
        value = put_prices[i, j]
        color = cmap(norm(value))
        brightness = (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2])
        text_color = 'white' if brightness < 0.5 else 'black'
        plt.text(strike_prices[j], volatility_range[i], f'{value:.2f}',
                 ha='center', va='center', color=text_color)

# Customizing ticks to place intervals in the middle of the boxes
plt.xticks(ticks=strike_prices, labels=[f'{price:.2f}' for price in strike_prices], rotation=45)
plt.yticks(ticks=volatility_range, labels=[f'{vol:.2f}' for vol in volatility_range])

# Show the combined plot with both heat maps
plt.tight_layout(rect=[0, 0, 1, 0.94])
plt.show()