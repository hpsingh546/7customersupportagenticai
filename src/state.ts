//we will create custome state where we store and what will be the next representive agent

import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

export const stateAnnotation=Annotation.Root({
    ...MessagesAnnotation.spec,//it represent message (all the message history)
    nextRepresentive:Annotation<String>//here we are storing custome state
})