Personal finance tracker
This app will be a web app deployed with vercel that uses Plaid transactions API to connect to my bank account. Every new transaction it parses, the app will show with the description and amount, and ask me to categorize it. The categories will look like tags, and for starters, they will be 

Categorization
Any transaction should be first types as either income, purchase, investment. 
Any purchase can be categorized as one of the default categories, a subcategory within a category, or misc. A transaction does not have to have a subcategory. By default, there won’t be any subcategories, and they will be built out slowly as needed. When a user selects a default category, they will be able to see the previously created subcategories, if any, and the option to add a subcategory. When the user selects Other for any purchase, they will be asked if there should be a category defined for this. They can select either a major category, which will be added as a default category among the other predefined ones, or a minor category, which will be a subcategory of “other”. 

Default Categories:
Food & Drinks
Rent & Bills
Groceries
Shopping
Home
Car
Fun
Transportation
Travel
Other


Hayat App Connection
One important functionality is this tracker’s connection to a previously created app, Hayat. Hayat uses google sheets API to turn a spreadsheet into a database. Both me and my partner log our common expenses there to split it. This connection is crucial in terms of capturing the full picture with my expenses, because not all money I spend out of my bank account is directly addressable to me as an expense, it is often shared. *** 


Regexes for common transactions 
I pay rent, electricity, gas, for home wifi every month. All uber transactions have the word uber in them. The descriptions for these payments are usually the same, so they are easily catchable with regexes. 





Tabs

Home screen
Net Amount of money I own (this is calculated as my bank account value - my credit card balances) 
“This Month” panel: money I spent so far, how different than average (of by the same day (adjusted for month length) previous months) 
This month pie chart (when clicked on the pie chart, the app leads to the categories tab)

Transactions Inbox
Looks like a list of all uncategorized transactions. When the “label” button in the transaction box is clicked, the option to label the transaction appears. The previously described categorization logic is applied. 
After labeling, a button can be clicked to show if this was a shared expense. If it is, a menu will pop up to create a hayat-app input, with the same template of a written description, amount, label, who is owed (is it I paid, shared 50-50?). The amount and label should be prefilled, the description should be inputted by the user (since the hayat app descriptions are often very short). 

Categories 
The “this month” purchases pie chart is shown in the middle, and when each individual slice is clicked, below a list of all transactions for that slice is shown with descriptions, labels, and amounts. With a drop down menu on top, the breakdown of a previous month can be shown (e.g. March 2026). If a transaction has been mislabeled, from the drill down, it can be edited. 

Analysis
I need to think more and decide after I start using the app about what different insights I would want to see on this tab. 

-------------------------------------------------------------------------------------------------------------------------------
Ideas:

Money spent/ net profit/ money invested or saved, in different timeframes. Categorical piechart. 
Money spent this month so far pie chart by category
Month by month pie charts
Seeing transactions by category

Gifts as a category: if I paid for my friends dinner, I should categorize half of it as mine and half of it as a gift (maybe). Or it could just be in the fun category. 
