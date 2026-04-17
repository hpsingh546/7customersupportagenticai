import { tool } from "@langchain/core/tools";
    import { createRetrieverTool } from "@langchain/classic/tools/retriever";
import { vectorStore } from "./indexdpcx";

// Define tools
export const getOffers = tool(
    () => {
        // codersgyan platform (backend) -> api -> get offers

        return JSON.stringify([
            {
                code: 'LAUNCH',
                discount_percent: 30,
            },
            {
                code: 'FIRST_20',
                discount_percent: 20,
            },
        ]);
    },
    {
        name: 'offers_query_tool',
        description: 'Call this tool to get the available discounts and offers',
    });

const retriever = vectorStore.asRetriever();

export const knowledgebaseRetriverTool = createRetrieverTool(
  retriever,
  {
      name: 'retrieve_learning_knowledge_base',
    description: 'Search and return information about syllabus, courses, FAQs, career doubts.',
  },
);
