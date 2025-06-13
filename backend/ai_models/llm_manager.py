import logging
from typing import Optional, List, Dict, Any
from llama_cpp import Llama
from config import settings
import json

logger = logging.getLogger(__name__)

class LLMManager:
    """Manages the local LLM for text generation"""
    
    def __init__(self):
        self.model: Optional[Llama] = None
        self.model_loaded = False
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the LLM model"""
        try:
            logger.info(f"Loading LLM model from {settings.llm_model_path}")
            logger.info(f"Using device: {settings.get_device()}")
            
            self.model = Llama(**settings.get_llm_config())
            self.model_loaded = True
            
            logger.info("LLM model loaded successfully")
            if settings.cuda_available and settings.use_cuda:
                logger.info(f"Running on GPU with {settings.llm_gpu_layers} layers")
            else:
                logger.info("Running on CPU")
                
        except Exception as e:
            logger.error(f"Failed to load LLM model: {e}")
            self.model_loaded = False
    
    def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        language: str = "en"
    ) -> str:
        """Generate a response from the LLM"""
        if not self.model_loaded or not self.model:
            return "I'm sorry, but the AI model is not available at the moment."
        
        try:
            # Format the prompt based on Llama 2 chat format
            if system_prompt:
                full_prompt = f"<s>[INST] <<SYS>>\n{system_prompt}\n<</SYS>>\n\n{prompt} [/INST]"
            else:
                full_prompt = f"<s>[INST] {prompt} [/INST]"
            
            # Add language instruction if needed
            if language == "ja":
                full_prompt = full_prompt.replace("[/INST]", "\nPlease respond in Japanese. [/INST]")
            
            # Generate response
            response = self.model(
                full_prompt,
                max_tokens=max_tokens or settings.llm_max_tokens,
                temperature=temperature or settings.llm_temperature,
                top_p=settings.llm_top_p,
                echo=False,
                stop=["</s>", "[INST]", "<<SYS>>"]
            )
            
            return response['choices'][0]['text'].strip()
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return "I encountered an error while processing your request."
    
    def generate_with_tools(
        self,
        prompt: str,
        tools: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        language: str = "en"
    ) -> Dict[str, Any]:
        """Generate a response with tool usage capability"""
        if not self.model_loaded or not self.model:
            return {"response": "Model not available", "tool_calls": []}
        
        try:
            # Create a system prompt that includes tool descriptions
            tool_descriptions = "\n".join([
                f"- {tool['name']}: {tool['description']}"
                for tool in tools
            ])
            
            enhanced_system_prompt = f"""You are an AI assistant with access to the following tools:
{tool_descriptions}

When you need to use a tool, respond with a JSON object in this format:
{{"tool": "tool_name", "parameters": {{"param1": "value1", "param2": "value2"}}}}

{system_prompt or settings.agent_personality}"""
            
            # Generate response
            response_text = self.generate_response(
                prompt,
                enhanced_system_prompt,
                language=language
            )
            
            # Parse for tool calls
            tool_calls = []
            try:
                # Simple parsing for tool calls in JSON format
                import re
                json_pattern = r'\{[^{}]*"tool"[^{}]*\}'
                matches = re.findall(json_pattern, response_text)
                
                for match in matches:
                    try:
                        tool_call = json.loads(match)
                        if "tool" in tool_call:
                            tool_calls.append(tool_call)
                    except:
                        pass
                
                # Remove tool calls from response
                for match in matches:
                    response_text = response_text.replace(match, "")
                
            except Exception as e:
                logger.error(f"Error parsing tool calls: {e}")
            
            return {
                "response": response_text.strip(),
                "tool_calls": tool_calls
            }
            
        except Exception as e:
            logger.error(f"Error in generate_with_tools: {e}")
            return {"response": "Error processing request", "tool_calls": []}
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model"""
        return {
            "model_loaded": self.model_loaded,
            "model_name": settings.llm_model_name,
            "device": settings.get_device(),
            "context_length": settings.llm_context_length,
            "gpu_layers": settings.llm_gpu_layers if settings.use_cuda else 0
        }