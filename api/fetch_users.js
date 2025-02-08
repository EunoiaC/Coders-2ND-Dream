// This function returns all users for a given plan and all possible specific data for that plan.
// - Salesforce Worker and higher subscriptions get mutual github repo info

// Check subscription payment status

/* Free tier
    - Load five users
    - Add a timestamp to user after successful retrieval, this will be used to check if the function is called again and the user is
      eligible for more matches
    - On client-side, prevent click of start-matching button if the timestamp is within the last week
 */