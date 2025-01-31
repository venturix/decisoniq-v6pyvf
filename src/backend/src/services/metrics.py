"""
Service module implementing business logic for customer success metrics calculation,
aggregation, and analysis with optimized performance and caching.

Version: Python 3.11+
Dependencies:
- pandas==2.x
- numpy==1.24+
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from uuid import UUID

import numpy as np
import pandas as pd

from models.metrics import CustomerMetric, AggregateMetric
from db.repositories.customers import CustomerRepository
from db.repositories.risk import RiskRepository

# Configure module logger
logger = logging.getLogger(__name__)

# Global configuration
CACHE_TTL = 300  # 5 minutes cache TTL
METRIC_WEIGHTS = {
    "usage": 0.4,
    "engagement": 0.3,
    "support": 0.3
}
RISK_THRESHOLDS = {
    "high": 80,
    "medium": 60,
    "low": 40
}

class MetricsService:
    """Enhanced service class implementing business logic for metrics calculation and analysis."""

    def __init__(self, customer_repo: CustomerRepository, risk_repo: RiskRepository):
        """Initialize metrics service with required repositories and cache."""
        self._customer_repo = customer_repo
        self._risk_repo = risk_repo
        self._cache = {}
        self._setup_logging()

    def _setup_logging(self) -> None:
        """Configure enhanced logging with performance tracking."""
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        self.logger.setLevel(logging.INFO)

    async def calculate_customer_health(self, customer_id: UUID) -> Dict[str, Any]:
        """
        Calculates overall health score for a customer with weighted components and caching.
        
        Args:
            customer_id: UUID of customer to analyze
            
        Returns:
            Dict containing health score and analysis details
        """
        cache_key = f"health:{str(customer_id)}"
        
        # Check cache first
        if cache_key in self._cache:
            cached_data = self._cache[cache_key]
            if (datetime.utcnow() - cached_data['timestamp']).seconds < CACHE_TTL:
                return cached_data['data']

        try:
            # Get customer risk profile
            risk_profile = await self._risk_repo.get_risk_profile(customer_id)
            if not risk_profile:
                raise ValueError(f"No risk profile found for customer {customer_id}")

            # Calculate component scores
            usage_score = self._calculate_usage_metrics(customer_id)
            engagement_score = self._calculate_engagement_metrics(customer_id)
            support_score = self._calculate_support_metrics(customer_id)

            # Calculate weighted health score
            health_score = (
                usage_score * METRIC_WEIGHTS["usage"] +
                engagement_score * METRIC_WEIGHTS["engagement"] +
                support_score * METRIC_WEIGHTS["support"]
            )

            # Generate confidence metrics
            confidence = self._calculate_confidence_metrics([
                usage_score,
                engagement_score,
                support_score
            ])

            result = {
                "health_score": round(health_score, 2),
                "confidence_level": confidence,
                "components": {
                    "usage": usage_score,
                    "engagement": engagement_score,
                    "support": support_score
                },
                "risk_level": self._determine_risk_level(risk_profile.score),
                "timestamp": datetime.utcnow().isoformat()
            }

            # Update cache
            self._cache[cache_key] = {
                "data": result,
                "timestamp": datetime.utcnow()
            }

            return result

        except Exception as e:
            self.logger.error(f"Error calculating health score: {str(e)}")
            raise

    async def aggregate_metrics(
        self,
        metric_type: str,
        aggregation_period: str
    ) -> AggregateMetric:
        """
        Aggregates metrics across customers or time periods with statistical analysis.
        
        Args:
            metric_type: Type of metric to aggregate
            aggregation_period: Time period for aggregation
            
        Returns:
            AggregateMetric containing aggregated results and analysis
        """
        try:
            # Validate inputs
            CustomerMetric.validate_value(metric_type, {"type": "metric_type"})

            # Get raw metrics data
            metrics = await self._get_metrics_for_period(metric_type, aggregation_period)
            
            # Convert to pandas DataFrame for efficient analysis
            df = pd.DataFrame(metrics)
            
            # Calculate statistical aggregates
            aggregates = {
                "mean": float(df["value"].mean()),
                "median": float(df["value"].median()),
                "std_dev": float(df["value"].std()),
                "count": len(df),
                "min": float(df["value"].min()),
                "max": float(df["value"].max())
            }

            # Calculate trends
            trends = self._calculate_metric_trends(df)

            # Create aggregate metric
            aggregate = AggregateMetric(
                metric_type=metric_type,
                aggregation_period=aggregation_period,
                value=aggregates["mean"],
                sample_size=aggregates["count"],
                breakdown=self._generate_metric_breakdown(df),
                period_start=df["measured_at"].min(),
                period_end=df["measured_at"].max(),
                statistical_metadata={
                    "aggregates": aggregates,
                    "trends": trends,
                    "confidence_interval": self._calculate_confidence_interval(df["value"])
                }
            )

            return aggregate

        except Exception as e:
            self.logger.error(f"Error aggregating metrics: {str(e)}")
            raise

    async def calculate_revenue_impact(
        self,
        customer_ids: List[UUID]
    ) -> Dict[str, Any]:
        """
        Calculates potential revenue impact from customer health with predictive analysis.
        
        Args:
            customer_ids: List of customer UUIDs to analyze
            
        Returns:
            Dict containing revenue impact analysis and predictions
        """
        try:
            impact_analysis = {
                "total_at_risk": 0.0,
                "expansion_opportunity": 0.0,
                "customer_segments": {},
                "recommendations": []
            }

            for customer_id in customer_ids:
                customer = await self._customer_repo.get_by_id(customer_id)
                risk_profile = await self._risk_repo.get_risk_profile(customer_id)
                
                if customer and risk_profile:
                    # Calculate revenue at risk
                    risk_factor = risk_profile.score / 100.0
                    revenue_at_risk = float(customer.mrr) * risk_factor
                    
                    # Calculate expansion opportunity
                    health_score = (await self.calculate_customer_health(customer_id))["health_score"]
                    expansion_factor = max(0, (health_score - 70) / 30) if health_score > 70 else 0
                    expansion_opportunity = float(customer.mrr) * expansion_factor * 0.2

                    # Update analysis
                    impact_analysis["total_at_risk"] += revenue_at_risk
                    impact_analysis["expansion_opportunity"] += expansion_opportunity
                    
                    # Segment analysis
                    risk_level = self._determine_risk_level(risk_profile.score)
                    if risk_level not in impact_analysis["customer_segments"]:
                        impact_analysis["customer_segments"][risk_level] = {
                            "count": 0,
                            "revenue_at_risk": 0.0
                        }
                    impact_analysis["customer_segments"][risk_level]["count"] += 1
                    impact_analysis["customer_segments"][risk_level]["revenue_at_risk"] += revenue_at_risk

            # Generate recommendations
            impact_analysis["recommendations"] = self._generate_impact_recommendations(impact_analysis)

            return impact_analysis

        except Exception as e:
            self.logger.error(f"Error calculating revenue impact: {str(e)}")
            raise

    async def generate_performance_report(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Generates comprehensive performance metrics report with trends and recommendations.
        
        Args:
            start_date: Start date for report period
            end_date: End date for report period
            
        Returns:
            Dict containing detailed performance report and insights
        """
        try:
            report = {
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "metrics": {},
                "trends": {},
                "insights": [],
                "recommendations": []
            }

            # Calculate key metrics
            metrics_data = await self._get_metrics_for_period("health_score", "daily", start_date, end_date)
            df = pd.DataFrame(metrics_data)

            # Calculate metric statistics
            report["metrics"] = {
                "average_health_score": float(df["value"].mean()),
                "health_score_improvement": float(df["value"].diff().mean()),
                "at_risk_customers": len(df[df["value"] < RISK_THRESHOLDS["medium"]]),
                "healthy_customers": len(df[df["value"] > RISK_THRESHOLDS["high"]])
            }

            # Calculate trends
            report["trends"] = self._calculate_metric_trends(df)

            # Generate insights
            report["insights"] = self._generate_performance_insights(report["metrics"], report["trends"])

            # Generate recommendations
            report["recommendations"] = self._generate_performance_recommendations(report["insights"])

            return report

        except Exception as e:
            self.logger.error(f"Error generating performance report: {str(e)}")
            raise

    def _calculate_confidence_metrics(self, scores: List[float]) -> float:
        """Calculate confidence level for metric calculations."""
        if not scores:
            return 0.0
        std_dev = np.std(scores)
        return max(0, min(100, 100 * (1 - std_dev / 100)))

    def _calculate_confidence_interval(
        self,
        values: pd.Series,
        confidence: float = 0.95
    ) -> Dict[str, float]:
        """Calculate confidence interval for metric values."""
        mean = values.mean()
        std_err = values.std() / np.sqrt(len(values))
        z_score = 1.96  # 95% confidence
        
        return {
            "lower": float(mean - z_score * std_err),
            "upper": float(mean + z_score * std_err),
            "confidence": confidence
        }

    def _determine_risk_level(self, risk_score: float) -> str:
        """Determine risk level based on thresholds."""
        if risk_score >= RISK_THRESHOLDS["high"]:
            return "high"
        elif risk_score >= RISK_THRESHOLDS["medium"]:
            return "medium"
        return "low"

    def _calculate_metric_trends(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate comprehensive trend analysis for metrics."""
        return {
            "direction": "increasing" if df["value"].diff().mean() > 0 else "decreasing",
            "volatility": float(df["value"].std()),
            "momentum": float(df["value"].diff().mean()),
            "seasonality": self._detect_seasonality(df)
        }

    def _detect_seasonality(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Detect seasonal patterns in metric data."""
        try:
            # Simple seasonality detection using autocorrelation
            autocorr = pd.Series(df["value"]).autocorr()
            return {
                "detected": abs(autocorr) > 0.7,
                "strength": float(abs(autocorr)),
                "period": "daily" if len(df) >= 7 else "insufficient_data"
            }
        except Exception:
            return {"detected": False, "strength": 0.0, "period": "unknown"}

    def _generate_impact_recommendations(self, analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate prioritized recommendations based on impact analysis."""
        recommendations = []
        
        if analysis["total_at_risk"] > 0:
            recommendations.append({
                "priority": "high",
                "action": "Revenue Protection",
                "description": f"Address ${analysis['total_at_risk']:,.2f} at-risk revenue",
                "impact": "immediate"
            })

        if analysis["expansion_opportunity"] > 0:
            recommendations.append({
                "priority": "medium",
                "action": "Revenue Expansion",
                "description": f"Pursue ${analysis['expansion_opportunity']:,.2f} expansion opportunity",
                "impact": "30-day"
            })

        return recommendations

    def _generate_performance_insights(
        self,
        metrics: Dict[str, Any],
        trends: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate actionable insights from performance metrics."""
        insights = []
        
        if metrics["health_score_improvement"] > 0:
            insights.append({
                "type": "positive",
                "metric": "health_score",
                "message": f"Health scores improved by {metrics['health_score_improvement']:.1f} points",
                "significance": "high"
            })
        
        if metrics["at_risk_customers"] > 0:
            insights.append({
                "type": "warning",
                "metric": "at_risk",
                "message": f"{metrics['at_risk_customers']} customers require attention",
                "significance": "high"
            })

        return insights

    def _generate_performance_recommendations(
        self,
        insights: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate recommendations based on performance insights."""
        recommendations = []
        
        for insight in insights:
            if insight["type"] == "warning" and insight["significance"] == "high":
                recommendations.append({
                    "priority": "high",
                    "action": "Customer Intervention",
                    "description": f"Address {insight['message']}",
                    "timeline": "immediate"
                })

        return recommendations