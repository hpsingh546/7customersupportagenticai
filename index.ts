import { StateGraph } from "@langchain/langgraph";
import { stateAnnotation } from "./src/state.ts";
import { model } from "./src/model.ts";

async function frontDeskSupport(state: typeof stateAnnotation.State) {
  const SYSTEM_PROMPT = `You are frontline support staff for Coder’s Gyan, an ed-tech company that helps software developers excel in their careers through practical web development and Generative AI courses.
Be concise in your responses.
You can chat with students and help them with basic questions, but if the student is having a marketing or learning support query,
do not try to answer the question directly or gather information.
Instead, immediately transfer them to the marketing team(promo codes, discounts, offers, and special campaigns) or learning support team(courses, syllabus coverage, learning paths, and study strategies) by asking the user to hold for a moment.
Otherwise, just respond conversationally.`; //systen persona
  const supportResponse = await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    ...state.messages, //user message when we invoke our graph then it store inside state inside messages here we passing message history this is array so we spread it
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
  );
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
function marketingSupport(state: typeof stateAnnotation.State) {
  console.log("handling by marketing support");
  return state;
}
function learningSupport(state: typeof stateAnnotation.State) {
  console.log("handling by learning support");

  return state;
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

const graph = new StateGraph(stateAnnotation)
  .addNode("frontDeskSupport", frontDeskSupport)
  .addNode("marketingSupport", marketingSupport)
  .addNode("learningSupport", learningSupport)
  .addEdge("__start__", "frontDeskSupport")
  .addConditionalEdges("frontDeskSupport", whoIsNext, {
    marketingSupport: "marketingSupport",
    learningSupport: "learningSupport",
    __end__: "__end__",
  })
  .addEdge("learningSupport", "__end__")
  .addEdge("marketingSupport", "__end__");
const app = graph.compile();
// invoke

async function main() {
  const stream = await app.stream({
    messages: [
      {
        role: "user",
        content: "do you have coupon?",
      },
    ],
  });

  for await (const value of stream) {
    console.log("----STEP----");
    console.log(value);
    console.log("----STEP----");
  }
}

main();
