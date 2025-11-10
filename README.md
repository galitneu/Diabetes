Certainly. Here is the focused and practical README in English, suitable for GitHub, emphasizing the project's goals, structure, and usage.

***

# Diabetes Readmission Prediction

## 🎯 Project Goal
This project develops a machine learning model to predict the risk of diabetes patients being readmitted to the hospital within 30 days of discharge.
The primary goal is to assist medical teams in identifying high-risk patients to prevent readmissions. The project places a special emphasis on maximizing **Recall** (sensitivity), based on the medical understanding that a false alarm (False Positive) is preferable to missing a patient at risk (False Negative).

## 📂 Project Structure (Files)

The process is divided into three Jupyter notebooks, each focusing on a different stage of the data pipeline:

1.  **`01_Data_Preparation.ipynb`** (originally: `Copy_of_Dibetes_Data_Preperation_ (11).ipynb`)
    * Loading raw data.
    * Data cleaning: Handling missing values, removing irrelevant records (deceased, hospice).
    * Basic Feature Engineering: Grouping categories, creating a binary target variable (`readmitted < 30`).
    * Saving a clean dataset for further work.

2.  **`02_Exploratory_Data_Analysis.ipynb`** (originally: `Diabetes_EDA_Final_with_ydata (6).ipynb`)
    * In-depth statistical analysis to understand the relationships between variables and readmission.
    * Visualizations for comparing distributions.
    * Statistical significance tests (Mann-Whitney, Chi-Square) to identify the most influential features.

3.  **`03_Modeling_and_Evaluation.ipynb`** (originally: `Diabetes_CLEANED_feature_and_Model (7).ipynb`)
    * Advanced Feature Engineering (interactions, complex risk indicators).
    * Handling imbalanced data using RandomUnderSampler.
    * Training and comparing models (Logistic Regression, Random Forest, XGBoost, LightGBM, CatBoost).
    * Optimizing the selected model (CatBoost) and the classification threshold (Threshold Tuning) to maximize Recall.

## 🚀 How to Run
1.  Clone the repository: `git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git`
 
2.  Run the notebooks in numerical order (01 -> 02 -> 03) to ensure proper data flow.

## 📊 Key Results
* The final model (**CatBoost**) achieved a significant improvement in identifying at-risk patients (Recall) compared to a baseline model.
* The most influential factors for readmission risk are: number of previous inpatient visits, length of current hospital stay, and number of medical diagnoses.