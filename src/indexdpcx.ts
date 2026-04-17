import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import "dotenv/config";

// *  * 3.generate vector embeding
//* 4.store the vector embeding in vector database
const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  dimensions:512,
});

const pinecone = new PineconeClient(); //create a client

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME as string);

export const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  pineconeIndex,
  maxConcurrency: 5,
});

export async function invoketheDocument(filePath: string) {
  //1.Load the document -pdf,txt=done
  const loader = new PDFLoader(filePath, { splitPages: false });
  const doc = await loader.load();
  // * 2.chunk the document=done
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });
 
  const texts = await textSplitter.splitText(doc[0]?.pageContent as string); //her we get chunk of array
  const documents = texts.map((chunk) => {
    return {
      pageContent: chunk,
      metadata: doc[0]?.metadata as any,
    };
  });
  console.log(documents);

  await vectorStore.addDocuments(documents);
  // console.log(documents);
}
invoketheDocument("./cg-knowledge-base.pdf")