def compute_retention_risk(usage_data: dict) -> dict:
    """
    Compute churn score from usage_data.
    Scoring thresholds (additive):
    - Login dropped 50%+ → +30
    - Feature adoption < 30 → +20
    - Avg ticket sentiment < -0.3 → +25
    - Days to renewal < 60 → +15
    - NPS < 6 → +10
    Cap at 100
    Returns: {churn_score, churn_reason, intervention_recommendation}
    """
    score = 0
    reasons = []
    
    if usage_data.get("login_drop_pct", 0) >= 50:
        score += 30
    elif usage_data.get("login_frequency", 50) < 5:
        score += 30
        
    if usage_data.get("feature_adoption", 100) < 30:
        score += 20
        reasons.append("Low feature adoption (<30%)")
        
    if usage_data.get("avg_ticket_sentiment", 0) < -0.3:
        score += 25
        reasons.append("Negative support ticket sentiment")
        
    if usage_data.get("days_to_renewal", 365) < 60:
        score += 15
        reasons.append("Upcoming renewal risk")
        
    if usage_data.get("nps", 10) < 6:
        score += 10
        reasons.append("Detractor NPS score")
        
    if usage_data.get("login_drop_pct", 0) >= 50:
        reasons.insert(0, "Significant drop in login frequency")
        
    churn_score = min(score, 100)
    
    churn_reason = "; ".join(reasons) if reasons else "Account usage is healthy."
    
    intervention = None
    if churn_score > 40:
        if usage_data.get("avg_ticket_sentiment", 0) < -0.3:
            intervention = "High-touch call with CS Manager"
        elif usage_data.get("feature_adoption", 100) < 30:
            intervention = "Offer feature training session"
        elif usage_data.get("login_drop_pct", 0) >= 50:
            intervention = "Engage executive sponsor"
        else:
            intervention = "Schedule success review"
            
    return {
        "churn_score": churn_score,
        "churn_reason": churn_reason,
        "intervention_recommendation": intervention
    }
