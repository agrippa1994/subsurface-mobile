// AI-generated (Claude)
//
// Stand-ins for the Qt classes core/import-suunto-json.cpp uses, implemented
// over nlohmann::json. Included through the Qt-named headers next to this file
// (<QJsonDocument>, <QJsonObject>, <QJsonArray>, <QJsonValue>), so the importer
// compiles byte-identical to upstream apart from the FIT paths patch 0007
// removes.
//
// This is deliberately only the surface that file touches - Qt's JSON API is
// far larger. The semantics that matter are copied from Qt's documentation:
//
//   - reading a missing key yields an *undefined* value, which is distinct from
//     a JSON null (the importer relies on that to walk Pressure, Pressure2, ...
//     until the keys run out);
//   - every conversion takes a default that is returned when the value has a
//     different type, so a malformed document degrades instead of throwing;
//   - QJsonDocument::fromJson() returns a null document on a parse error rather
//     than reporting it.
#pragma once

#include <nlohmann/json.hpp>

#include <string>
#include <utility>

class QString {
public:
	QString() = default;
	QString(const char *value) : value_(value ? value : "") {}
	explicit QString(std::string value) : value_(std::move(value)) {}

	std::string toStdString() const { return value_; }
	const std::string &str() const { return value_; }

	// Qt's QString::arg() substitutes the lowest-numbered %N placeholder.
	// The importer only ever builds "Pressure%1", so that is all this does.
	QString arg(int n) const
	{
		std::string out = value_;
		size_t at = out.find("%1");
		if (at != std::string::npos)
			out.replace(at, 2, std::to_string(n));
		return QString(out);
	}

	QString toLower() const
	{
		std::string out = value_;
		for (char &c : out)
			c = static_cast<char>(tolower(static_cast<unsigned char>(c)));
		return QString(out);
	}

	bool isEmpty() const { return value_.empty(); }

	bool operator==(const QString &other) const { return value_ == other.value_; }
	bool operator!=(const QString &other) const { return value_ != other.value_; }
	bool operator<(const QString &other) const { return value_ < other.value_; }

private:
	std::string value_;
};

class QByteArray {
public:
	QByteArray() = default;

	// Qt's fromRawData() does not copy; nothing here outlives the buffer it
	// is made from, so a copy would only cost.
	static QByteArray fromRawData(const char *data, size_t size)
	{
		QByteArray out;
		out.data_ = data;
		out.size_ = size;
		return out;
	}

	const char *constData() const { return data_; }
	size_t size() const { return size_; }

private:
	const char *data_ = nullptr;
	size_t size_ = 0;
};

class QJsonObject;
class QJsonArray;

class QJsonValue {
public:
	QJsonValue() = default;
	explicit QJsonValue(nlohmann::json value) : value_(std::move(value)), defined_(true) {}

	bool isUndefined() const { return !defined_; }
	bool isNull() const { return !defined_ || value_.is_null(); }

	QString toString() const
	{
		return value_.is_string() ? QString(value_.get<std::string>()) : QString();
	}
	double toDouble(double fallback = 0) const
	{
		return value_.is_number() ? value_.get<double>() : fallback;
	}
	int toInt(int fallback = 0) const
	{
		return value_.is_number() ? static_cast<int>(value_.get<double>()) : fallback;
	}
	bool toBool(bool fallback = false) const
	{
		return value_.is_boolean() ? value_.get<bool>() : fallback;
	}
	inline QJsonObject toObject() const;
	inline QJsonArray toArray() const;

	const nlohmann::json &json() const { return value_; }

private:
	nlohmann::json value_;
	bool defined_ = false;
};

class QJsonObject {
public:
	QJsonObject() = default;
	explicit QJsonObject(nlohmann::json value) : value_(std::move(value)) {}

	bool isEmpty() const { return !value_.is_object() || value_.empty(); }
	bool contains(const QString &key) const
	{
		return value_.is_object() && value_.contains(key.str());
	}

	QJsonValue value(const QString &key) const
	{
		if (!value_.is_object())
			return QJsonValue();
		auto it = value_.find(key.str());
		return it == value_.end() ? QJsonValue() : QJsonValue(*it);
	}
	QJsonValue operator[](const QString &key) const { return value(key); }

private:
	nlohmann::json value_;
};

class QJsonArray {
public:
	QJsonArray() = default;
	explicit QJsonArray(nlohmann::json value) : value_(std::move(value)) {}

	bool isEmpty() const { return !value_.is_array() || value_.empty(); }
	int size() const { return value_.is_array() ? static_cast<int>(value_.size()) : 0; }
	QJsonValue operator[](int index) const
	{
		if (!value_.is_array() || index < 0 || index >= size())
			return QJsonValue();
		return QJsonValue(value_[static_cast<size_t>(index)]);
	}

	// Iteration hands out values by value; `for (const QJsonValue &v : array)`
	// binds them to a const reference, which extends their lifetime for the
	// body of the loop.
	class const_iterator {
	public:
		const_iterator(const nlohmann::json *array, size_t at) : array_(array), at_(at) {}
		QJsonValue operator*() const { return QJsonValue((*array_)[at_]); }
		const_iterator &operator++()
		{
			at_++;
			return *this;
		}
		bool operator!=(const const_iterator &other) const { return at_ != other.at_; }

	private:
		const nlohmann::json *array_;
		size_t at_;
	};

	const_iterator begin() const { return const_iterator(&value_, 0); }
	const_iterator end() const { return const_iterator(&value_, static_cast<size_t>(size())); }

private:
	nlohmann::json value_ = nlohmann::json::array();
};

inline QJsonObject QJsonValue::toObject() const
{
	return value_.is_object() ? QJsonObject(value_) : QJsonObject();
}

inline QJsonArray QJsonValue::toArray() const
{
	return value_.is_array() ? QJsonArray(value_) : QJsonArray();
}

class QJsonDocument {
public:
	QJsonDocument() = default;

	static QJsonDocument fromJson(const QByteArray &bytes)
	{
		QJsonDocument doc;
		// Qt reports a parse error through the (unused here) error argument
		// and returns a null document; nlohmann throws unless told not to.
		doc.value_ = nlohmann::json::parse(bytes.constData(), bytes.constData() + bytes.size(),
						   nullptr, false);
		return doc;
	}

	bool isNull() const { return value_.is_discarded() || value_.is_null(); }
	bool isObject() const { return value_.is_object(); }
	QJsonObject object() const { return QJsonObject(value_); }

private:
	nlohmann::json value_;
};
