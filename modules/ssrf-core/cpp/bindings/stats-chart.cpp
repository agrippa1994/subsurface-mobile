// AI-generated (Claude)
//
// Configurable statistics: what stats/statsview.cpp and the stats/*series.cpp files
// do on the desktop, minus the drawing.
//
// stats/statsstate.cpp decides what can be combined with what, and
// stats/statsvariables.cpp holds the variables, binners and operations. Both are
// compiled unchanged. Those files come with no plotting: the upstream code that turns
// a state into bins, axes and items lives in StatsView::plot*Chart(), tangled with Qt
// Quick, so its data half is ported here, function for function, with the upstream
// name above each. What is left to TypeScript is geometry.
//
// Nothing is kept between calls. The configuration is the JSON the app persists, and
// a call rebuilds the StatsState from it, the way the desktop's would have got there.

#include "stats-chart.h"

#include "api-errors.h"

#include "core/dive.h"
#include "core/pref.h"
#include "stats/statsstate.h"
#include "stats/statsvariables.h"

#include "ssrf-qstring.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <numeric>
#include <string>
#include <tuple>

namespace ssrf {

namespace {

const double NaN = std::numeric_limits<double>::quiet_NaN();

// --- Names for the enums: stable in a persisted configuration, whatever upstream
// does to their order. ------------------------------------------------------------

template <typename E>
struct named {
	E value;
	const char *name;
};

const named<ChartType> chart_types[] = {
	{ ChartType::DiscreteBar, "DiscreteBar" },
	{ ChartType::DiscreteValue, "DiscreteValue" },
	{ ChartType::DiscreteCount, "DiscreteCount" },
	{ ChartType::DiscreteBox, "DiscreteBox" },
	{ ChartType::DiscreteScatter, "DiscreteScatter" },
	{ ChartType::Pie, "Pie" },
	{ ChartType::HistogramCount, "HistogramCount" },
	{ ChartType::HistogramValue, "HistogramValue" },
	{ ChartType::HistogramBox, "HistogramBox" },
	{ ChartType::HistogramStacked, "HistogramStacked" },
	{ ChartType::ScatterPlot, "ScatterPlot" },
	{ ChartType::Invalid, "Invalid" },
};

const named<ChartSubType> chart_subtypes[] = {
	{ ChartSubType::Vertical, "Vertical" },
	{ ChartSubType::VerticalGrouped, "VerticalGrouped" },
	{ ChartSubType::VerticalStacked, "VerticalStacked" },
	{ ChartSubType::Horizontal, "Horizontal" },
	{ ChartSubType::HorizontalGrouped, "HorizontalGrouped" },
	{ ChartSubType::HorizontalStacked, "HorizontalStacked" },
	{ ChartSubType::Dots, "Dots" },
	{ ChartSubType::Box, "Box" },
	{ ChartSubType::Pie, "Pie" },
};

const named<ChartSortMode> sort_modes[] = {
	{ ChartSortMode::Bin, "Bin" },
	{ ChartSortMode::Count, "Count" },
	{ ChartSortMode::Value, "Value" },
};

const named<StatsOperation> operations[] = {
	{ StatsOperation::Median, "Median" },
	{ StatsOperation::Mean, "Mean" },
	{ StatsOperation::TimeWeightedMean, "TimeWeightedMean" },
	{ StatsOperation::Sum, "Sum" },
	{ StatsOperation::Min, "Min" },
	{ StatsOperation::Max, "Max" },
	{ StatsOperation::Invalid, "Invalid" },
};

template <typename E, size_t N>
const char *name_of(const named<E> (&table)[N], E value)
{
	for (const auto &entry : table) {
		if (entry.value == value)
			return entry.name;
	}
	return table[0].name;
}

template <typename E, size_t N>
bool value_of(const named<E> (&table)[N], const std::string &name, E &out)
{
	for (const auto &entry : table) {
		if (name == entry.name) {
			out = entry.value;
			return true;
		}
	}
	return false;
}

int chart_id(ChartType type, ChartSubType subtype)
{
	// StatsState's own encoding, see toInt() in statsstate.cpp.
	return (static_cast<int>(type) << 16) | static_cast<int>(subtype);
}

int variable_id(const std::string &name)
{
	for (size_t i = 0; i < stats_variables.size(); ++i) {
		if (stats_variables[i]->name().str() == name)
			return static_cast<int>(i);
	}
	return -1;
}

// --- The configuration ------------------------------------------------------------

std::string text(const json &object, const char *key)
{
	auto it = object.find(key);
	return it != object.end() && it->is_string() ? it->get<std::string>() : std::string();
}

void set_chart(StatsState &state, const json &chart)
{
	ChartType type;
	ChartSubType subtype;
	if (value_of(chart_types, text(chart, "type"), type) && value_of(chart_subtypes, text(chart, "subtype"), subtype))
		state.chartChanged(chart_id(type, subtype));
}

void set_operation(StatsState &state, const std::string &name)
{
	StatsOperation operation;
	if (value_of(operations, name, operation))
		state.var2OperationChanged(static_cast<int>(operation));
}

void set_sort(StatsState &state, const std::string &name)
{
	ChartSortMode mode;
	if (value_of(sort_modes, name, mode))
		state.sortMode1Changed(static_cast<int>(mode));
}

void set_var2(StatsState &state, const std::string &name)
{
	// -1 is StatsState's own "none", and an unknown name lands there too.
	state.var2Changed(variable_id(name));
}

const struct {
	const char *key;
	bool StatsState::*member;
	const char *upstream; // The name the feature list gives it.
} features[] = {
	{ "labels", &StatsState::labels, "labels" },
	{ "legend", &StatsState::legend, "legend" },
	{ "median", &StatsState::median, "median" },
	{ "mean", &StatsState::mean, "mean" },
	{ "quartiles", &StatsState::quartiles, "quartiles" },
	{ "regression", &StatsState::regression, "linear regression" },
	{ "confidence", &StatsState::confidence, "95% confidence area" },
};

// Rebuilds the state in the order the choices constrain each other: a binner is only
// meaningful for its variable, and a chart only once all else is decided, so a saved
// non-recommended chart survives as the user chose it (validate(false) keeps it).
StatsState state_from(const json &config)
{
	StatsState state;
	if (!config.is_object())
		return state;

	int var1 = variable_id(text(config, "var1"));
	if (var1 >= 0)
		state.var1Changed(var1);
	set_var2(state, text(config, "var2"));

	StatsState::UIState ui = state.getUIState();
	auto binner1 = config.find("binner1");
	if (binner1 != config.end() && binner1->is_number_integer() && !ui.binners1.binners.empty())
		state.binner1Changed(binner1->get<int>());

	ui = state.getUIState();
	auto binner2 = config.find("binner2");
	if (binner2 != config.end() && binner2->is_number_integer() && !ui.binners2.binners.empty())
		state.binner2Changed(binner2->get<int>());

	set_operation(state, text(config, "operation"));

	auto chart = config.find("chart");
	if (chart != config.end() && chart->is_object())
		set_chart(state, *chart);
	set_sort(state, text(config, "sort"));

	auto saved = config.find("features");
	if (saved != config.end() && saved->is_object()) {
		for (const auto &feature : features)
			state.*feature.member = saved->value(feature.key, state.*feature.member);
	}
	return state;
}

void apply_change(StatsState &state, const json &change)
{
	std::string kind = text(change, "kind");
	const json &value = change.contains("value") ? change.at("value") : json();
	if (kind == "var1") {
		int id = value.is_string() ? variable_id(value.get<std::string>()) : -1;
		if (id >= 0)
			state.var1Changed(id);
	} else if (kind == "var2") {
		set_var2(state, value.is_string() ? value.get<std::string>() : std::string());
	} else if (kind == "binner1" && value.is_number_integer()) {
		state.binner1Changed(value.get<int>());
	} else if (kind == "binner2" && value.is_number_integer()) {
		state.binner2Changed(value.get<int>());
	} else if (kind == "operation" && value.is_string()) {
		set_operation(state, value.get<std::string>());
	} else if (kind == "chart" && value.is_object()) {
		set_chart(state, value);
	} else if (kind == "sort" && value.is_string()) {
		set_sort(state, value.get<std::string>());
	} else if (kind == "feature" && value.is_object()) {
		std::string key = text(value, "key");
		for (const auto &feature : features) {
			if (key == feature.key)
				state.*feature.member = value.value("on", false);
		}
	} else {
		throw api_error("unknown statistics change: " + kind);
	}
}

json config_json(const StatsState &state, const StatsState::UIState &ui)
{
	json out = {
		{ "var1", state.var1 ? state.var1->name().str() : std::string() },
		{ "var2", state.var2 ? json(state.var2->name().str()) : json(nullptr) },
		{ "binner1", ui.binners1.selected },
		{ "binner2", ui.binners2.selected },
		{ "operation", name_of(operations, state.var2Operation) },
		{ "chart", { { "type", name_of(chart_types, state.type) }, { "subtype", name_of(chart_subtypes, state.subtype) } } },
		{ "sort", name_of(sort_modes, state.sortMode1) },
	};
	json saved = json::object();
	for (const auto &feature : features)
		saved[feature.key] = state.*feature.member;
	out["features"] = saved;
	return out;
}

const char *type_name(const StatsVariable &variable)
{
	switch (variable.type()) {
	case StatsVariable::Type::Discrete:
		return "discrete";
	case StatsVariable::Type::Continuous:
		return "continuous";
	default:
		return "numeric";
	}
}

json strings_json(const std::vector<QString> &strings)
{
	json out = json::array();
	for (const QString &s : strings)
		out.push_back(s.str());
	return out;
}

json options_json(const StatsState::UIState &ui)
{
	json var1 = json::array();
	for (const auto &variable : ui.var1.variables) {
		const StatsVariable &v = *stats_variables[variable.id];
		var1.push_back({ { "name", v.name().str() }, { "type", type_name(v) }, { "unit", v.unitSymbol().str() } });
	}
	json var2 = json::array();
	for (const auto &variable : ui.var2.variables) {
		if (variable.id < 0)
			continue; // "none" is the null of the configuration.
		const StatsVariable &v = *stats_variables[variable.id];
		var2.push_back({ { "name", v.name().str() }, { "type", type_name(v) }, { "unit", v.unitSymbol().str() } });
	}

	json charts = json::array();
	for (const auto &chart : ui.charts.charts) {
		auto type = static_cast<ChartType>(chart.id >> 16);
		charts.push_back({
			{ "type", name_of(chart_types, type) },
			{ "subtype", name_of(chart_subtypes, chart.subtype) },
			{ "name", chart.name.str() },
			{ "subtypeName", chart.subtypeName.str() },
			{ "warning", chart.warning },
			{ "selected", chart.id == ui.charts.selected },
		});
	}

	json operations_out = json::array();
	for (const auto &operation : ui.operations2.variables) {
		operations_out.push_back({
			{ "key", name_of(operations, static_cast<StatsOperation>(operation.id)) },
			{ "name", operation.name.str() },
		});
	}

	json sorts = json::array();
	for (const auto &mode : ui.sortMode1.variables)
		sorts.push_back({ { "key", name_of(sort_modes, static_cast<ChartSortMode>(mode.id)) }, { "name", mode.name.str() } });

	json features_out = json::array();
	for (const auto &feature : ui.features) {
		for (const auto &known : features) {
			if (feature.name.str() == known.upstream)
				features_out.push_back({ { "key", known.key }, { "on", feature.selected } });
		}
	}

	return json{
		{ "var1", var1 },
		{ "var2", var2 },
		{ "binners1", strings_json(ui.binners1.binners) },
		{ "binners2", strings_json(ui.binners2.binners) },
		{ "operations", operations_out },
		{ "sorts", sorts },
		{ "charts", charts },
		{ "features", features_out },
	};
}

// --- Chart assembly: the data half of StatsView --------------------------------------

json number(double value)
{
	return std::isfinite(value) ? json(value) : json(nullptr);
}

json dive_ids(const std::vector<dive *> &dives)
{
	std::vector<int> ids;
	ids.reserve(dives.size());
	for (const dive *d : dives)
		ids.push_back(d->id);
	return ids;
}

json base_chart(const char *family, const QString &title, bool horizontal)
{
	return json{ { "family", family }, { "title", title.str() }, { "horizontal", horizontal }, { "stacked", false }, { "histogram", false } };
}

json empty_chart(const QString &title)
{
	return base_chart("empty", title, false);
}

json count_axis(int max)
{
	return json{ { "kind", "count" }, { "title", "No. dives" }, { "min", 0 }, { "max", max }, { "decimals", 0 }, { "unit", "" } };
}

json value_axis(const StatsVariable &variable, double min, double max)
{
	return json{ { "kind", "value" }, { "title", variable.nameWithUnit().str() }, { "min", number(min) }, { "max", number(max) }, { "decimals", variable.decimals() }, { "unit", variable.unitSymbol().str() } };
}

json category_axis(const QString &title)
{
	return json{ { "kind", "category" }, { "title", title.str() } };
}

json histogram_axis(const QString &title, const StatsBinner &binner, const StatsBin &last)
{
	return json{
		{ "kind", "histogram" },
		{ "title", title.str() },
		{ "lastLabel", binner.formatUpperBound(last).str() },
		{ "lastBound", binner.upperBoundToFloat(last) },
	};
}

// The tick a histogram bin contributes (createHistogramAxis()), and where it sits.
void add_histogram_fields(json &item, const StatsBinner &binner, const StatsBin &bin)
{
	item["from"] = binner.lowerBoundToFloat(bin);
	item["to"] = binner.upperBoundToFloat(bin);
	item["tick"] = binner.formatLowerBound(bin).str();
	item["prefer"] = binner.preferBin(bin);
}

// Yearly-style binners only have a label at the start of a run of bins.
json results_json(const StatsOperationResults &results)
{
	return json{
		{ "median", number(results.median) },
		{ "mean", number(results.mean) },
		{ "timeWeightedMean", number(results.timeWeightedMean) },
		{ "sum", number(results.sum) },
		{ "min", number(results.min) },
		{ "max", number(results.max) },
	};
}

// BarPlotData: bins of a second variable inside bins of the first. Different category
// bins can have different value bins, so the union is kept sorted as they turn up.
struct BinDives {
	StatsBinPtr bin;
	std::vector<std::vector<dive *>> dives;
	int total;
};

struct BarPlotData {
	std::vector<BinDives> hbins;
	std::vector<StatsBinPtr> vbins;
	int maxCount = 0;
	int maxCategoryCount = 0;

	BarPlotData(std::vector<StatsBinDives> &categoryBins, const StatsBinner &valueBinner)
	{
		for (auto &[bin, dives] : categoryBins) {
			hbins.push_back({ std::move(bin), std::vector<std::vector<dive *>>(vbins.size()), 0 });
			for (auto &[vbin, binDives] : valueBinner.bin_dives(dives, false)) {
				auto it = std::lower_bound(vbins.begin(), vbins.end(), vbin,
							   [](const StatsBinPtr &p, const StatsBinPtr &b) { return *p < *b; });
				ptrdiff_t pos = it - vbins.begin();
				if (it == vbins.end() || **it != *vbin) {
					vbins.insert(it, std::move(vbin));
					for (auto &[b, v, total] : hbins)
						v.insert(v.begin() + pos, std::vector<dive *>());
				}
				int count = static_cast<int>(binDives.size());
				hbins.back().dives[pos] = std::move(binDives);
				hbins.back().total += count;
				maxCount = std::max(maxCount, count);
			}
			maxCategoryCount = std::max(maxCategoryCount, hbins.back().total);
		}
	}
};

json segments_json(const std::vector<std::vector<dive *>> &bins)
{
	json out = json::array();
	for (const auto &bin : bins)
		out.push_back({ { "count", static_cast<int>(bin.size()) }, { "dives", dive_ids(bin) } });
	return out;
}

json series_names(const std::vector<StatsBinPtr> &vbins, const StatsBinner &binner)
{
	json out = json::array();
	for (const auto &vbin : vbins)
		out.push_back(binner.formatWithUnit(*vbin).str());
	return out;
}

// StatsView::plotBarChart
json plot_bar_chart(const std::vector<dive *> &dives, ChartSubType subType, ChartSortMode sortMode,
		    const StatsVariable &category, const StatsBinner *categoryBinner,
		    const StatsVariable &value, const StatsBinner *valueBinner)
{
	if (!categoryBinner || !valueBinner)
		return empty_chart(QString());

	QString title = value.nameWithBinnerUnit(*valueBinner);
	std::vector<StatsBinDives> categoryBins = categoryBinner->bin_dives(dives, false);
	if (categoryBins.empty())
		return empty_chart(title);

	if (sortMode == ChartSortMode::Count) {
		std::sort(categoryBins.begin(), categoryBins.end(),
			  [](const StatsBinDives &b1, const StatsBinDives &b2) { return b1.value.size() > b2.value.size(); });
	}

	bool isStacked = subType == ChartSubType::VerticalStacked || subType == ChartSubType::HorizontalStacked;
	bool isHorizontal = subType == ChartSubType::HorizontalGrouped || subType == ChartSubType::HorizontalStacked;

	json out = base_chart("bar", title, isHorizontal);
	out["stacked"] = isStacked;
	out["catAxis"] = category_axis(category.nameWithBinnerUnit(*categoryBinner));

	BarPlotData data(categoryBins, *valueBinner);
	out["valAxis"] = count_axis(isStacked ? data.maxCategoryCount : data.maxCount);
	out["series"] = series_names(data.vbins, *valueBinner);

	json items = json::array();
	double pos = 0.0;
	for (auto &[hbin, binDives, total] : data.hbins) {
		items.push_back({
			{ "from", pos - 0.5 },
			{ "to", pos + 0.5 },
			{ "label", categoryBinner->format(*hbin).str() },
			{ "full", categoryBinner->formatWithUnit(*hbin).str() },
			{ "count", total },
			{ "total", total },
			{ "segments", segments_json(binDives) },
		});
		pos += 1.0;
	}
	out["items"] = items;
	return out;
}

const double lowest = std::numeric_limits<double>::lowest();

// getMinMaxValue() over operation results.
std::pair<double, double> min_max(const std::vector<StatsBinOp> &bins, StatsOperation op)
{
	double min = 1e14, max = lowest;
	bool found = false;
	for (const auto &[bin, res] : bins) {
		if (!res.isValid())
			continue;
		double v = res.get(op);
		if (!std::isnan(v)) {
			min = std::min(min, v);
			max = std::max(max, v);
			found = true;
		}
	}
	return found ? std::make_pair(min, max) : std::make_pair(0.0, 0.0);
}

// StatsView::plotValueChart and plotHistogramValueChart.
json plot_value_chart(const std::vector<dive *> &dives, ChartSubType subType, ChartSortMode sortMode, bool histogram,
		      const StatsVariable &category, const StatsBinner *categoryBinner,
		      const StatsVariable &value, StatsOperation operation)
{
	if (!categoryBinner)
		return empty_chart(QString());

	QString title = QStringLiteral("%1 (%2)").arg(value.name(), StatsVariable::operationName(operation));
	std::vector<StatsBinOp> categoryBins = value.bin_operations(*categoryBinner, dives, histogram);
	if (categoryBins.empty())
		return empty_chart(title);

	if (sortMode == ChartSortMode::Count) {
		std::sort(categoryBins.begin(), categoryBins.end(),
			  [](const StatsBinOp &b1, const StatsBinOp &b2) { return b1.value.dives.size() > b2.value.dives.size(); });
	} else if (sortMode == ChartSortMode::Value) {
		std::sort(categoryBins.begin(), categoryBins.end(),
			  [operation](const StatsBinOp &b1, const StatsBinOp &b2) { return b1.value.get(operation) < b2.value.get(operation); });
	}

	bool isHorizontal = subType == ChartSubType::Horizontal;
	const auto [minValue, maxValue] = min_max(categoryBins, operation);

	json out = base_chart("bar", title, isHorizontal);
	out["histogram"] = histogram;
	out["catAxis"] = histogram ? histogram_axis(category.nameWithBinnerUnit(*categoryBinner), *categoryBinner, *categoryBins.back().bin)
				   : category_axis(category.nameWithBinnerUnit(*categoryBinner));
	// A categorical value chart starts at 0; a histogram only reaches below it when
	// the values do.
	out["valAxis"] = value_axis(value, histogram ? std::min(0.0, minValue) : 0.0, maxValue);

	json items = json::array();
	double pos = 0.0;
	for (const auto &[bin, res] : categoryBins) {
		json item = {
			{ "from", pos - 0.5 },
			{ "to", pos + 0.5 },
			{ "label", categoryBinner->format(*bin).str() },
			{ "full", categoryBinner->formatWithUnit(*bin).str() },
			{ "count", static_cast<int>(res.dives.size()) },
		};
		if (histogram)
			add_histogram_fields(item, *categoryBinner, *bin);
		if (res.isValid()) {
			item["value"] = number(res.get(operation));
			item["operations"] = results_json(res);
		} else {
			item["value"] = nullptr;
		}
		item["dives"] = dive_ids(res.dives);
		items.push_back(std::move(item));
		pos += 1.0;
	}
	out["items"] = items;
	return out;
}

int total_count(const std::vector<StatsBinDives> &bins)
{
	int total = 0;
	for (const auto &[bin, binDives] : bins)
		total += static_cast<int>(binDives.size());
	return total;
}

int max_count(const std::vector<StatsBinDives> &bins)
{
	int max = 0;
	for (const auto &[bin, binDives] : bins)
		max = std::max(max, static_cast<int>(binDives.size()));
	return max;
}

// StatsView::plotDiscreteCountChart
json plot_discrete_count_chart(const std::vector<dive *> &dives, ChartSubType subType, ChartSortMode sortMode,
			       const StatsVariable &category, const StatsBinner *categoryBinner)
{
	if (!categoryBinner)
		return empty_chart(QString());

	QString title = category.nameWithBinnerUnit(*categoryBinner);
	std::vector<StatsBinDives> categoryBins = categoryBinner->bin_dives(dives, false);
	if (categoryBins.empty())
		return empty_chart(title);

	if (sortMode == ChartSortMode::Count) {
		std::sort(categoryBins.begin(), categoryBins.end(),
			  [](const StatsBinDives &b1, const StatsBinDives &b2) { return b1.value.size() > b2.value.size(); });
	}

	int total = total_count(categoryBins);
	bool isHorizontal = subType != ChartSubType::Vertical;

	json out = base_chart("bar", title, isHorizontal);
	out["catAxis"] = category_axis(title);
	out["valAxis"] = count_axis(max_count(categoryBins));

	json items = json::array();
	double pos = 0.0;
	for (const auto &[bin, binDives] : categoryBins) {
		items.push_back({
			{ "from", pos - 0.5 },
			{ "to", pos + 0.5 },
			{ "label", categoryBinner->format(*bin).str() },
			{ "full", categoryBinner->formatWithUnit(*bin).str() },
			{ "count", static_cast<int>(binDives.size()) },
			{ "total", total },
			{ "value", static_cast<int>(binDives.size()) },
			{ "dives", dive_ids(binDives) },
		});
		pos += 1.0;
	}
	out["items"] = items;
	return out;
}

// StatsView::plotPieChart and the slice selection of the PieSeries constructor.
json plot_pie_chart(const std::vector<dive *> &dives, ChartSortMode sortMode,
		    const StatsVariable &category, const StatsBinner *categoryBinner)
{
	if (!categoryBinner)
		return empty_chart(QString());

	QString title = category.nameWithBinnerUnit(*categoryBinner);
	std::vector<StatsBinDives> categoryBins = categoryBinner->bin_dives(dives, false);
	if (categoryBins.empty())
		return empty_chart(title);

	std::vector<std::pair<QString, std::vector<dive *>>> data;
	data.reserve(categoryBins.size());
	for (auto &[bin, binDives] : categoryBins)
		data.emplace_back(categoryBinner->formatWithUnit(*bin), std::move(binDives));

	const int smallest_slice_percentage = 5;
	const int min_slices = 5;

	int totalCount = 0;
	for (const auto &[name, binDives] : data)
		totalCount += static_cast<int>(binDives.size());

	std::vector<int> sorted(data.size());
	std::iota(sorted.begin(), sorted.end(), 0);
	std::sort(sorted.begin(), sorted.end(), [&data](int idx1, int idx2) {
		return std::make_tuple(-static_cast<long>(data[idx1].second.size()), idx1) <
		       std::make_tuple(-static_cast<long>(data[idx2].second.size()), idx2);
	});
	auto it = std::find_if(sorted.begin(), sorted.end(), [count = totalCount, &data](int idx) {
		return static_cast<int>(data[idx].second.size()) * 100 / count < smallest_slice_percentage;
	});
	if (it - sorted.begin() < min_slices) {
		int sum = 0;
		for (auto it2 = sorted.begin(); it2 != it; ++it2)
			sum += static_cast<int>(data[*it2].second.size());
		while (it != sorted.end() && sum * 2 < totalCount && it - sorted.begin() < min_slices) {
			sum += static_cast<int>(data[*it].second.size());
			++it;
		}
	}
	if (sorted.end() - it == 1)
		++it;
	if (sortMode == ChartSortMode::Bin) {
		std::sort(sorted.begin(), it);
		std::sort(it, sorted.end());
	}

	json items = json::array();
	json series = json::array();
	int act = 0;
	for (auto it2 = sorted.begin(); it2 != it; ++it2) {
		const auto &[name, binDives] = data[*it2];
		int count = static_cast<int>(binDives.size());
		items.push_back({
			{ "label", name.str() },
			{ "full", name.str() },
			{ "from", act },
			{ "to", act + count },
			{ "count", count },
			{ "total", totalCount },
			{ "dives", dive_ids(binDives) },
		});
		series.push_back(name.str());
		act += count;
	}
	if (it != sorted.end()) {
		std::vector<dive *> otherDives;
		json other = json::array();
		int count = 0;
		for (auto it2 = it; it2 != sorted.end(); ++it2) {
			const auto &[name, binDives] = data[*it2];
			other.push_back({ { "name", name.str() }, { "count", static_cast<int>(binDives.size()) } });
			count += static_cast<int>(binDives.size());
			otherDives.insert(otherDives.end(), binDives.begin(), binDives.end());
		}
		// A dive with two buddies is in two of those bins, and one row of a list.
		std::sort(otherDives.begin(), otherDives.end());
		otherDives.erase(std::unique(otherDives.begin(), otherDives.end()), otherDives.end());
		QString name = QStringLiteral("other (%1 items)").arg(other.size());
		items.push_back({
			{ "label", name.str() },
			{ "full", name.str() },
			{ "from", act },
			{ "to", act + count },
			{ "count", count },
			{ "total", totalCount },
			{ "other", other },
			{ "dives", dive_ids(otherDives) },
		});
		series.push_back(name.str());
	}

	json out = base_chart("pie", title, false);
	out["series"] = series;
	out["items"] = items;
	return out;
}

// getMinMaxValue() over quartiles.
std::pair<double, double> min_max(const std::vector<StatsBinQuartiles> &bins)
{
	double min = 1e14, max = lowest;
	bool found = false;
	for (const auto &[bin, q] : bins) {
		if (!std::isnan(q.min) && q.min < min)
			min = q.min;
		if (!std::isnan(q.max) && q.max > max)
			max = q.max;
		found = found || !std::isnan(q.min) || !std::isnan(q.max);
	}
	return found ? std::make_pair(min, max) : std::make_pair(0.0, 0.0);
}

// StatsView::plotDiscreteBoxChart and plotHistogramBoxChart.
json plot_box_chart(const std::vector<dive *> &dives, bool histogram,
		    const StatsVariable &category, const StatsBinner *categoryBinner, const StatsVariable &value)
{
	if (!categoryBinner)
		return empty_chart(QString());

	QString title = value.name();
	std::vector<StatsBinQuartiles> categoryBins = value.bin_quartiles(*categoryBinner, dives, histogram);
	if (categoryBins.empty())
		return empty_chart(title);

	QString axisTitle = category.nameWithBinnerUnit(*categoryBinner);
	const auto [minY, maxY] = min_max(categoryBins);

	json out = base_chart("box", title, false);
	out["histogram"] = histogram;
	out["catAxis"] = histogram ? histogram_axis(axisTitle, *categoryBinner, *categoryBins.back().bin) : category_axis(axisTitle);
	out["valAxis"] = value_axis(value, minY, maxY);

	json items = json::array();
	double pos = 0.0;
	for (const auto &[bin, q] : categoryBins) {
		json item = {
			{ "from", pos - 0.5 },
			{ "to", pos + 0.5 },
			{ "label", categoryBinner->format(*bin).str() },
			{ "full", categoryBinner->formatWithUnit(*bin).str() },
			{ "count", static_cast<int>(q.dives.size()) },
			{ "dives", dive_ids(q.dives) },
		};
		if (histogram)
			add_histogram_fields(item, *categoryBinner, *bin);
		if (q.isValid()) {
			item["box"] = { { "min", q.min }, { "q1", q.q1 }, { "q2", q.q2 }, { "q3", q.q3 }, { "max", q.max } };
		} else {
			item["box"] = nullptr;
		}
		items.push_back(std::move(item));
		pos += 1.0;
	}
	out["items"] = items;
	return out;
}

// StatsView::plotDiscreteScatter
json plot_discrete_scatter(const std::vector<dive *> &dives, const StatsVariable &category,
			   const StatsBinner *categoryBinner, const StatsVariable &value)
{
	if (!categoryBinner)
		return empty_chart(QString());

	QString title = value.name();
	std::vector<StatsBinValues> categoryBins = value.bin_values(*categoryBinner, dives, false);
	if (categoryBins.empty())
		return empty_chart(title);

	double minValue = 1e14, maxValue = lowest;
	bool found = false;
	for (const auto &[bin, array] : categoryBins) {
		// The values of a bin are sorted, see StatsVariable::values().
		if (!array.empty()) {
			minValue = std::min(minValue, array.front().v);
			maxValue = std::max(maxValue, array.back().v);
			found = true;
		}
	}
	if (!found)
		minValue = maxValue = 0.0;

	json out = base_chart("scatter", title, false);
	out["catAxis"] = category_axis(category.nameWithBinnerUnit(*categoryBinner));
	out["valAxis"] = value_axis(value, minValue, maxValue);
	out["xUnit"] = "";

	json xs = json::array(), ys = json::array(), ids = json::array(), items = json::array();
	double x = 0.0;
	for (const auto &[bin, array] : categoryBins) {
		for (const auto &[v, d] : array) {
			xs.push_back(x);
			ys.push_back(v);
			ids.push_back(d->id);
		}
		std::vector<dive *> binDives;
		binDives.reserve(array.size());
		for (const auto &[v, d] : array)
			binDives.push_back(d);
		json item = {
			{ "from", x - 0.5 },
			{ "to", x + 0.5 },
			{ "label", categoryBinner->format(*bin).str() },
			{ "full", categoryBinner->formatWithUnit(*bin).str() },
			{ "count", static_cast<int>(array.size()) },
			{ "dives", dive_ids(binDives) },
		};
		StatsQuartiles quartiles = StatsVariable::quartiles(array);
		if (quartiles.isValid())
			item["quartiles"] = { { "q1", quartiles.q1 }, { "q2", quartiles.q2 }, { "q3", quartiles.q3 } };
		items.push_back(std::move(item));
		x += 1.0;
	}
	out["points"] = { { "x", xs }, { "y", ys }, { "dives", ids } };
	out["items"] = items;
	return out;
}

// StatsView::plotHistogramCountChart
json plot_histogram_count_chart(const std::vector<dive *> &dives, ChartSubType subType,
				const StatsVariable &category, const StatsBinner *categoryBinner)
{
	if (!categoryBinner)
		return empty_chart(QString());

	QString title = category.name();
	std::vector<StatsBinDives> categoryBins = categoryBinner->bin_dives(dives, true);
	if (categoryBins.empty())
		return empty_chart(title);

	bool isHorizontal = subType == ChartSubType::Horizontal;
	json out = base_chart("bar", title, isHorizontal);
	out["histogram"] = true;
	out["catAxis"] = histogram_axis(category.nameWithBinnerUnit(*categoryBinner), *categoryBinner, *categoryBins.back().bin);
	out["valAxis"] = count_axis(max_count(categoryBins));

	int total = total_count(categoryBins);
	json items = json::array();
	for (const auto &[bin, binDives] : categoryBins) {
		json item = {
			{ "label", categoryBinner->format(*bin).str() },
			{ "full", categoryBinner->formatWithUnit(*bin).str() },
			{ "count", static_cast<int>(binDives.size()) },
			{ "total", total },
			{ "value", static_cast<int>(binDives.size()) },
			{ "dives", dive_ids(binDives) },
		};
		add_histogram_fields(item, *categoryBinner, *bin);
		items.push_back(std::move(item));
	}
	out["items"] = items;

	if (category.type() == StatsVariable::Type::Numeric) {
		out["mean"] = number(category.mean(dives));
		out["median"] = number(category.quartiles(dives).q2);
	}
	return out;
}

// StatsView::plotHistogramStackedChart
json plot_histogram_stacked_chart(const std::vector<dive *> &dives, ChartSubType subType,
				  const StatsVariable &category, const StatsBinner *categoryBinner,
				  const StatsVariable &value, const StatsBinner *valueBinner)
{
	if (!categoryBinner || !valueBinner)
		return empty_chart(QString());

	QString title = value.nameWithBinnerUnit(*valueBinner);
	std::vector<StatsBinDives> categoryBins = categoryBinner->bin_dives(dives, true);
	if (categoryBins.empty())
		return empty_chart(title);

	bool isHorizontal = subType == ChartSubType::HorizontalStacked;
	json out = base_chart("bar", title, isHorizontal);
	out["histogram"] = true;
	out["stacked"] = true;
	out["catAxis"] = histogram_axis(category.nameWithBinnerUnit(*categoryBinner), *categoryBinner, *categoryBins.back().bin);

	BarPlotData data(categoryBins, *valueBinner);
	out["valAxis"] = count_axis(data.maxCategoryCount);
	out["series"] = series_names(data.vbins, *valueBinner);

	json items = json::array();
	for (auto &[hbin, binDives, total] : data.hbins) {
		json item = {
			{ "label", categoryBinner->format(*hbin).str() },
			{ "full", categoryBinner->formatWithUnit(*hbin).str() },
			{ "count", total },
			{ "total", total },
			{ "segments", segments_json(binDives) },
		};
		add_histogram_fields(item, *categoryBinner, *hbin);
		items.push_back(std::move(item));
	}
	out["items"] = items;
	return out;
}

// is_linear_regression() of statsview.cpp, verbatim apart from std::abs: upstream's
// unqualified abs() can resolve to the integer one depending on the C++ library.
bool is_linear_regression(int sample_size, double cov, double sx2, double sy2)
{
	if (sample_size < 2)
		return false;
	if (sample_size <= 2)
		return true;

	const double tval[] = { 12.709, 4.303, 3.182, 2.776, 2.571, 2.447, 2.201, 2.120, 2.080, 2.056, 2.021, 1.960, 1.960 };
	const int t_df[] = { 1, 2, 3, 4, 5, 6, 11, 16, 21, 26, 40, 100, 100000 };
	int df = sample_size - 2;
	double t = (cov / sx2) / sqrt(((sy2 - cov * cov / sx2) / static_cast<double>(df)) / sx2);
	for (int i = static_cast<int>(std::size(tval)) - 2; i >= 0; i--) {
		if (df >= t_df[i]) {
			double t_lookup = tval[i] - (tval[i] - tval[i + 1]) * (df - t_df[i]) / (t_df[i + 1] - t_df[i]);
			return std::abs(t) >= t_lookup;
		}
	}
	return true;
}

// linear_regression() of statsview.cpp and the confidence area of regressionitem.cpp,
// which draws the line over the axis; here, over the data. Null when upstream draws
// neither, because the fit is not significant or the data has no spread in x.
json regression_json(const std::vector<StatsScatterItem> &v)
{
	int n = static_cast<int>(v.size());
	if (n < 2)
		return nullptr;
	double avg_x = 0.0, avg_y = 0.0;
	for (const auto &[x, y, d] : v) {
		avg_x += x;
		avg_y += y;
	}
	avg_x /= n;
	avg_y /= n;

	double cov = 0.0, sx2 = 0.0, sy2 = 0.0;
	for (const auto &[x, y, d] : v) {
		cov += (x - avg_x) * (y - avg_y);
		sx2 += (x - avg_x) * (x - avg_x);
		sy2 += (y - avg_y) * (y - avg_y);
	}
	if (std::fabs(sx2) < 1e-10 || !is_linear_regression(n, cov, sx2, sy2))
		return nullptr;

	double a = cov / sx2;
	double b = avg_y - a * avg_x;
	double res2 = 0.0;
	for (const auto &[x, y, d] : v)
		res2 += (y - a * x - b) * (y - a * x - b);
	double r2 = sy2 > 0.0 ? 1.0 - res2 / sy2 : 1.0;

	double minX = v.front().x, maxX = v.back().x;
	json band = json::array();
	if (n > 2) {
		const int samples = 51;
		for (int i = 0; i < samples; ++i) {
			double x = (maxX - minX) / (samples - 1) * i + minX;
			double half = 1.960 * sqrt(res2 / (n - 2) * (1.0 / n + (x - avg_x) * (x - avg_x) / (n - 1) * (n - 2) / sx2));
			band.push_back({ { "x", x }, { "low", a * x + b - half }, { "high", a * x + b + half } });
		}
	}
	return json{ { "a", a }, { "b", b }, { "r2", r2 }, { "n", n }, { "fromX", minX }, { "toX", maxX }, { "band", band } };
}

// StatsView::plotScatter
json plot_scatter(const std::vector<dive *> &dives, const StatsVariable &category, const StatsVariable &value)
{
	QString title = QStringLiteral("%1 vs. %2").arg(value.name(), category.name());
	std::vector<StatsScatterItem> points = category.scatter(value, dives);
	if (points.empty())
		return empty_chart(title);

	double minY = 1e14, maxY = lowest;
	json xs = json::array(), ys = json::array(), ids = json::array();
	for (const auto &[x, y, d] : points) {
		minY = std::min(minY, y);
		maxY = std::max(maxY, y);
		xs.push_back(x);
		ys.push_back(y);
		ids.push_back(d->id);
	}

	json out = base_chart("scatter", title, false);
	bool dates = category.type() == StatsVariable::Type::Continuous;
	out["catAxis"] = dates ? json{ { "kind", "date" }, { "title", category.nameWithUnit().str() }, { "min", points.front().x }, { "max", points.back().x } }
			       : value_axis(category, points.front().x, points.back().x);
	out["valAxis"] = value_axis(value, minY, maxY);
	out["points"] = { { "x", xs }, { "y", ys }, { "dives", ids } };
	out["regression"] = regression_json(points);
	out["items"] = json::array();
	return out;
}

// StatsView::plotChart
json plot_chart(const StatsState &state, const std::vector<dive *> &dives)
{
	if (!state.var1)
		return empty_chart(QString());
	switch (state.type) {
	case ChartType::DiscreteBar:
		if (!state.var2)
			return empty_chart(QString());
		return plot_bar_chart(dives, state.subtype, state.sortMode1, *state.var1, state.var1Binner, *state.var2, state.var2Binner);
	case ChartType::DiscreteValue:
		if (!state.var2)
			return empty_chart(QString());
		return plot_value_chart(dives, state.subtype, state.sortMode1, false, *state.var1, state.var1Binner, *state.var2, state.var2Operation);
	case ChartType::DiscreteCount:
		return plot_discrete_count_chart(dives, state.subtype, state.sortMode1, *state.var1, state.var1Binner);
	case ChartType::Pie:
		return plot_pie_chart(dives, state.sortMode1, *state.var1, state.var1Binner);
	case ChartType::DiscreteBox:
		if (!state.var2)
			return empty_chart(QString());
		return plot_box_chart(dives, false, *state.var1, state.var1Binner, *state.var2);
	case ChartType::DiscreteScatter:
		if (!state.var2)
			return empty_chart(QString());
		return plot_discrete_scatter(dives, *state.var1, state.var1Binner, *state.var2);
	case ChartType::HistogramCount:
		return plot_histogram_count_chart(dives, state.subtype, *state.var1, state.var1Binner);
	case ChartType::HistogramValue:
		if (!state.var2)
			return empty_chart(QString());
		return plot_value_chart(dives, state.subtype, state.sortMode1, true, *state.var1, state.var1Binner, *state.var2, state.var2Operation);
	case ChartType::HistogramStacked:
		if (!state.var2)
			return empty_chart(QString());
		return plot_histogram_stacked_chart(dives, state.subtype, *state.var1, state.var1Binner, *state.var2, state.var2Binner);
	case ChartType::HistogramBox:
		if (!state.var2)
			return empty_chart(QString());
		return plot_box_chart(dives, true, *state.var1, state.var1Binner, *state.var2);
	case ChartType::ScatterPlot:
		if (!state.var2)
			return empty_chart(QString());
		return plot_scatter(dives, *state.var1, *state.var2);
	default:
		return empty_chart(QString());
	}
}

// The unit in force for one call: the binners and every symbol read prefs.units, and
// the app keeps its unit system in its own settings.
class units_scope {
public:
	explicit units_scope(bool imperial) : saved_(prefs.units)
	{
		prefs.units = imperial ? IMPERIAL_units : SI_units;
	}
	~units_scope() { prefs.units = saved_; }

private:
	struct units saved_;
};

} // namespace

json stats_chart(const json &args, const std::vector<struct dive *> &dives)
{
	units_scope units(args.value("imperial", false));

	StatsState state = state_from(args.contains("config") ? args.at("config") : json());
	auto change = args.find("change");
	if (change != args.end() && change->is_object())
		apply_change(state, *change);

	StatsState::UIState ui = state.getUIState();
	json out = {
		{ "config", config_json(state, ui) },
		{ "options", options_json(ui) },
		{ "dives", static_cast<int>(dives.size()) },
	};
	if (args.value("plot", true))
		out["chart"] = plot_chart(state, dives);
	return out;
}

} // namespace ssrf
