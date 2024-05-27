import json
import matplotlib.pyplot as plt

# Load the JSON data
with open('./weth_volume.json', 'r') as file:
    data_list = json.load(file)

# Sort the data by amount in descending order and take the top 100
# 注意：之前的代码是按照升序排列的，这里更正为降序以获取“top”数据
top_100_data_desc = sorted(data_list, key=lambda x: float(x['amount']), reverse=True)[:50]
top_100_data = sorted(top_100_data_desc, key=lambda x: float(x['amount']))
# Prepare the labels and values for the plot
labels = [f"{item['token0']}-{item['token1']}" for item in top_100_data]
amounts = [float(item['amount']) for item in top_100_data]

# Create a bar chart without log scale
plt.figure(figsize=(10, 20))
barplot = plt.barh(labels, amounts, color='skyblue')

# Adding value labels on top of each bar
for index, value in enumerate(amounts):
    plt.text(value, index, f'{value:.2f}', color='black', va='center')  
# Remove the commented lines related to log scale
# No need to adjust xlim since we're not using log scale anymore

# Add title and labels, adjusting the title to reflect the change
plt.title('Top 50 Token Pairs by ETH Volume on 1inch V6 (5.23-5.24)')
plt.xlabel('Volume')
plt.ylabel('Token Pair')

# Rotate the labels for better readability
plt.xticks(rotation=45)

# Show the plot
plt.tight_layout()  # Adjust layout to fit everything nicely
plt.savefig('./image/TopPairByTradingVolume.png')  # Save the figure to a file
# If you also want to display the plot, uncomment the line below
# plt.show()