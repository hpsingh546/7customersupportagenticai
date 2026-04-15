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
