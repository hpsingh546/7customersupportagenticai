The error UnreachableNodeError is happening because you added marketingSupport and learningSupport as nodes, but you didn't create any paths (edges) that lead to them. In LangGraph, every node (except the start) must have an incoming edge.

In LangGraph.js/TypeScript, the fundamental difference remains the same: invoke is a single promise-based call for the final result, while stream is an async generator for real-time updates.

1. invoke (Final Result Only)invoke returns a single object containing the final state of the graph after all nodes have finished. It is ideal for background tasks or when you don't need to show progress to the user.

// Returns the final state as a single object
const finalState = await graph.invoke({
messages: [{ role: "user", content: "Tell me a joke." }]
});

console.log(finalState.messages.at(-1).content);

2. stream (Progressive Updates)stream allows you to receive data as it happens. You can choose different streamMode options to control what is yielded:values: Returns the full state after each node finishes.updates: Returns only the specific updates from each node.messages: Streams individual LLM tokens (chunks) as they are generated.

// Streams state updates from each node step-by-step
const stream = await graph.stream(
{ messages: [{ role: "user", content: "Tell me a joke." }] },
{ streamMode: "values" } // Get full state after every step
);

for await (const chunk of stream) {
console.log("--- New Update ---");
console.log(chunk);
}

Yes, exactly! Here's how the custom state object works:

stateAnnotation has two main properties:

...MessagesAnnotation.spec (expands to messages)

Contains the complete message history of the conversation
Automatically managed by LangGraph
Used to track all previous messages in the dialogue
nextRepresentative: Annotation<String>

Custom property you defined
Stores a string value indicating which agent should handle the next message
Examples: 'MARKETING', 'LEARNING', 'RESPOND', etc.
How they work together:
The messages property keeps track of what was said in the conversation
The nextRepresentative property decides where the message should be routed next
When the conditional edge calls whoIsNext(), it reads state.nextRepresentative to determine which agent node to invoke next
So essentially, you're creating a state that tracks both the conversation history and the routing decision for the next step in the workflow.

stateAnnotation.State this represent custome object which has two property

Yes, exactly! stateAnnotation.State is a custom state object with two properties:

messages

Comes from ...MessagesAnnotation.spec
Stores all the message history in the conversation
Array of message objects with role and content
nextRepresentative

Custom property you created
Type: String
Stores values like 'MARKETING', 'LEARNING', or 'RESPOND'
Used by whoIsNext() to determine routing
How it's used throughout the workflow:

// When you invoke the graph
app.invoke({
messages: [{role: "user", content: "Hi"}], // Property 1: messages
// Property 2: nextRepresentative will be added by frontDeskSupport
})

// In frontDeskSupport function
return {
messages: [supportResponse], // Updates messages
nextRepresentative: categorizationOutput.nextRepresentative, // Sets routing
};

// In whoIsNext conditional edge
if (state.nextRepresentative.includes('MARKETING')) {...} // Reads the routing

So the state object manages both conversation data (messages) and routing logic (nextRepresentative).

How execution work on marketing question

Based on your code, here is the exact sequence of how the graph executes when a user asks, "do you have coupon?"
The Execution Flow
**start** → frontDeskSupport
The graph begins. It calls the frontDeskSupport function.
The LLM identifies that the user is asking about coupons (Marketing).
The function returns nextRepresentative: "MARKETING".

frontDeskSupport → whoIsNext (Conditional Edge)
The router function whoIsNext looks at the state.
Since nextRepresentative is "MARKETING", it returns the string "marketingSupport".

marketingSupport Node
The marketingSupport function runs.
It uses model.bindTools(marketingTools).
The LLM sees "do you have coupon?" and decides it needs to call the getOffers tool.
It returns an AIMessage containing a tool_calls payload.

marketingSupport → isMarketingTool (Conditional Edge)
The router isMarketingTool checks the last message.
It finds tool_calls.length > 0, so it returns "marketingTools".

marketingTools Node (The ToolNode)
The prebuilt ToolNode executes the getOffers function.
It returns a ToolMessage containing the actual coupon data.

marketingTools → marketingSupport (Direct Edge)
You have a fixed edge .addEdge("marketingTools", "marketingSupport").
The flow goes back to the marketing agent so it can read the tool's result.

marketingSupport Node (Second Pass)
The agent runs again. Now it sees the tool output (e.g., "Use code SAVE10").
It generates a final friendly response for the user.
This time, the AIMessage does not have tool calls.

marketingSupport → isMarketingTool (Conditional Edge)
The router checks the last message again.
There are no tool calls this time.
It returns **end**.
**end**
The graph stops and returns the final state to your main() function.
