import { END, MemorySaver, StateGraph } from "@langchain/langgraph";
import { stateAnnotation } from "./src/state.ts";
import { model } from "./src/model.ts";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { getOffers, knowledgebaseRetriverTool } from "./src/tools.ts";
import type { AIMessage } from "@langchain/core/messages";
import readline from "node:readline/promises";

const marketingTools = [getOffers];
const marketingToolNode = new ToolNode(marketingTools);

const learningtools = [knowledgebaseRetriverTool];
const learningToolNode = new ToolNode(learningtools);

async function frontDeskSupport(state: typeof stateAnnotation.State) {
  const SYSTEM_PROMPT = `You are frontline support staff for Coder’s Gyan, an ed-tech company that helps software developers excel in their careers through practical web development and Generative AI courses.
Be concise in your responses.
You can chat with students and help them with basic questions, but if the student is having a marketing or learning support query,
do not try to answer the question directly or gather information.
Instead, immediately transfer them to the marketing team(promo codes, discounts, offers, and special campaigns) or learning support team(courses, syllabus coverage, learning paths, and study strategies) by asking the user to hold for a moment.
Otherwise, just respond conversationally.`; //systen persona
  const supportResponse = await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    ...state.messages, //user message when we invoke our graph then it store inside state inside messages here we passing message history this is array of object(messages) so we spread it
  ]);
  // console.log("support Response=>",supportResponse,typeof supportResponse);
  const CATEGORIZATION_SYSTEM_PROMPT = `You are an expert customer support routing system.
Your job is to detect whether a customer support representative is routing a user to a marketing team or learning support team, or if they are just responding conversationally.`; //persona

  const CATEGORIZATION_HUMAN_PROMPT = `The previous conversation is an interaction between a customer support representative and a user.
Extract whether the representative is routing the user to a marketing team or learning support team, or whether they are just responding conversationally.
Respond with a JSON object containing a single key called "nextRepresentative" with one of the following values:

If they want to route the user to the marketing team, respond with "MARKETING".
If they want to route the user to the learning support team, respond with "LEARNING".
Otherwise, respond only with the word "RESPOND".`; //{nextRepresentative:"MARKETING"}
  const categorizationResponse = await model.invoke(
    [
      { role: "system", content: CATEGORIZATION_SYSTEM_PROMPT },
      ...state.messages,
      supportResponse,
      { role: "user", content: CATEGORIZATION_HUMAN_PROMPT },
    ],
    {
      response_format: {
        type: "json_object",
      },
    },
  );//this llm work is to categorised whether 
  // console.log("categorizationResponse=>",categorizationResponse)
  //role :user we are tricking llm you can think of developer
  const categorizationOutput = JSON.parse(
    categorizationResponse.content as string,
  );

  return {
    messages: [supportResponse],
    nextRepresentative: categorizationOutput.nextRepresentative,
  };
}
async function marketingSupport(state: typeof stateAnnotation.State) {
  console.log("handling by marketing support");

  const llmWithTools = model.bindTools(marketingTools);

    const SYSTEM_PROMPT = `You are part of the Marketing Team at Coder's Gyan, an ed-tech company that helps software developers excel in their careers through practical web development and Generative AI courses.
You specialize in handling questions about promo codes, discounts, offers, and special campaigns.
Answer clearly, concisely, and in a friendly manner. For queries outside promotions (course content, learning), politely redirect the student to the correct team.
Important: Answer only using given context, else say I don't have enough information about it.`;

   let trimmedHistory = state.messages;

    if (trimmedHistory.at(-1)?.getType() === 'ai') {
        trimmedHistory = trimmedHistory.slice(0, -1); // [1, 2, 3] -> [1, 2]
    }
console.log("marketing message",trimmedHistory)
    const marketingResponse = await llmWithTools.invoke([
        {
            role: 'system',
            content: SYSTEM_PROMPT,
        },
        ...trimmedHistory,
    ]);

    return {
        messages: [marketingResponse],
    };
}
async function learningSupport(state: typeof stateAnnotation.State) {
  console.log("handling by learning support");
  const SYSTEM_PROMPT = `You are part of the Learning Support Team at Coder's Gyan, an ed-tech company that helps software developers excel in their careers through practical web development and Generative AI courses.
You assist students with questions about available courses, syllabus coverage, learning paths, and study strategies.
Keep your answers concise, clear, and supportive. Strictly use information from retrived context for answering queries. If the query is about learning issues, politely redirect the student to the respective team.
Important: Call retrieve_learning_knowledge_base max 3 times if the tool result is not relevant to original query.`;

    let trimmedHistory = state.messages;

    if (trimmedHistory.at(-1)?.getType() === 'ai') {
        trimmedHistory = trimmedHistory.slice(0, -1); // [1, 2, 3] -> [1, 2]
    }

    const llmWithTools = model.bindTools(learningtools);
 const learningResponse = await llmWithTools.invoke([
        {
            role: 'system',
            content: SYSTEM_PROMPT,
        },
        ...trimmedHistory,
    ]);

    return {
        messages: [learningResponse],
    };
}

function whoIsNext(state: typeof stateAnnotation.State) {
  if (state.nextRepresentative.includes("MARKETING")) {
    return "marketingSupport";
  } else if (state.nextRepresentative.includes("LEARNING")) {
    return "learningSupport";
  } else if (state.nextRepresentative.includes("RESPOND")) {
    return "__end__";
  } else {
    return "__end__";
  }
}
function isMarketingTool(state: typeof stateAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

    if (lastMessage.tool_calls?.length) {
        return 'marketingTools';
    }

    return '__end__';
}
function isLearningTool(state: typeof stateAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

    if (lastMessage.tool_calls?.length) {
        return 'learningTools';
    }

    return '__end__';
}
const graph = new StateGraph(stateAnnotation)
  .addNode("frontDeskSupport", frontDeskSupport)
  .addNode("marketingSupport", marketingSupport)
  .addNode("learningSupport", learningSupport)
  .addNode('marketingTools', marketingToolNode)
   .addNode('learningTools', learningToolNode)

  .addEdge("__start__", "frontDeskSupport")
  .addConditionalEdges("frontDeskSupport", whoIsNext, {
    marketingSupport: "marketingSupport",
    learningSupport: "learningSupport",
    __end__: "__end__",
  })
   .addConditionalEdges('learningSupport', isLearningTool, {
        learningTools: 'learningTools',
        __end__: END,
    })
 .addConditionalEdges('marketingSupport', isMarketingTool, {
        marketingTools: 'marketingTools',
        __end__: END,
    })
      .addEdge("marketingTools","marketingSupport")
          .addEdge('learningTools', 'learningSupport')

    

const app = graph.compile({checkpointer:new MemorySaver()});
// invoke

async function main() {
   const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  while (true) {
    const ques = await rl.question("You:");

    if (ques == "bye") break;
    //retrival check ubuntu
    const result = await app.invoke({
    messages: [
      {
        role: "user",
        content: ques,
      },
    ],
  },{configurable:{thread_id:'1'}});

 const message = result.messages;
   console.log("Ai:", message?.[message.length - 1]?.content);
}
rl.close();
}

main();
