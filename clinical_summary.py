import os
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))


def get_clinical_summary(note: str) -> str:
    """Return a structured clinical summary using Groq (Llama-3)."""
    try:
        llm = ChatGroq(temperature=0, model_name="llama-3.3-70b-versatile")

        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an ICU Clinical Decision Support agent. Summarize notes with high precision."),
            ("human", """
Analyze this MIMIC-III clinical note and provide a structured summary:
- **Chief Complaint:** Primary reason for admission.
- **Clinical Status:** Current hemodynamic/neurological state.
- **Sepsis Indicators:** Identify any mentions of fever, hypotension, or source of infection.

Note: {patient_note}
""")
        ])

        chain = prompt | llm | StrOutputParser()
        return chain.invoke({"patient_note": note})

    except Exception as e:
        return f"Summary unavailable — Groq service error: {e}"
